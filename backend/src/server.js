import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  readDb,
  writeDb,
  toCollection,
  withAuditFields,
  pickUserFromToken,
  applyFilter,
  applySort,
  parseJsonParam
} from './db.js';
import { buildPolicyPrompt, enforcePolicyOutput } from './policy.js';
import { buildRagContext } from './rag.js';
import { invokeOllama, fallbackAnswer } from './llm.js';
import { parseFeedbackJson, fallbackFeedback } from './feedback.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '../uploads');

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '4mb' }));
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
    cb(null, safeName);
  }
});
const upload = multer({ storage });

function tokenFromReq(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return req.headers['x-access-token'] || req.query.access_token || null;
}

async function attachUser(req, _res, next) {
  const db = await readDb();
  const token = tokenFromReq(req);
  req.user = pickUserFromToken(db, token) || null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    return next();
  };
}

function canAccessRecord(entity, record, user) {
  if (!user) return false;
  if (user.role === 'admin') return true;

  if (entity === 'Course') {
    return true;
  }

  if (entity === 'CourseEnrollment') {
    return record.student_id === user.id;
  }

  if (entity === 'ChatSession' || entity === 'Submission') {
    return record.student_id === user.id;
  }

  if (entity === 'Assignment' || entity === 'Flashcard') {
    return true;
  }

  return false;
}

function scopeEntityRead(entity, items, user) {
  if (!user) return [];
  if (user.role === 'admin') return items;

  if (entity === 'Course') {
    return items;
  }

  return items.filter((item) => canAccessRecord(entity, item, user));
}

async function extractText(filePath, mimetype) {
  try {
    if (mimetype.includes('text') || mimetype.includes('json')) {
      return await fs.readFile(filePath, 'utf-8');
    }
    return '';
  } catch {
    return '';
  }
}

app.use(attachUser);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'backend', timestamp: new Date().toISOString() });
});

app.get('/api/apps/public/prod/public-settings/by-id/:appId', (_req, res) => {
  res.json({
    id: _req.params.appId,
    public_settings: {
      auth_required: true,
      app_name: 'Learning Assistant Prototype'
    }
  });
});

app.post('/api/auth/dev-login', async (req, res) => {
  const { role = 'student' } = req.body || {};
  const db = await readDb();
  const user = db.users.find((entry) => entry.role === role) || db.users.find((entry) => entry.role === 'student');

  if (!user) {
    return res.status(404).json({ message: 'No test user found' });
  }

  return res.json({ token: user.token, user });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  return res.json(req.user);
});

app.post('/api/app-logs/in-app', requireAuth, async (req, res) => {
  const { pageName } = req.body || {};
  await writeDb((db) => {
    db.appLogs.push(withAuditFields({ user_id: req.user.id, pageName }));
    return db;
  });
  return res.json({ ok: true });
});

app.get('/api/entities/:entity', requireAuth, async (req, res) => {
  const { entity } = req.params;
  let collection;

  try {
    collection = toCollection(entity);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const db = await readDb();
  const filter = parseJsonParam(req.query.filter, {});
  const sort = String(req.query.sort || '');
  const limit = Number(req.query.limit || 0);

  let items = db[collection] || [];
  items = scopeEntityRead(entity, items, req.user);
  items = applyFilter(items, filter);
  items = applySort(items, sort);

  if (limit > 0) {
    items = items.slice(0, limit);
  }

  return res.json(items);
});

app.post('/api/entities/:entity', requireAuth, async (req, res) => {
  const { entity } = req.params;
  let collection;

  try {
    collection = toCollection(entity);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const input = req.body || {};

  if (req.user.role !== 'admin' && ['Course', 'Assignment', 'Flashcard'].includes(entity)) {
    return res.status(403).json({ message: 'Only instructor can create this resource' });
  }

  if (entity === 'CourseEnrollment' && input.student_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Cannot create enrollment for another user' });
  }

  const created = withAuditFields(input);

  await writeDb((db) => {
    db[collection].push(created);
    return db;
  });

  return res.status(201).json(created);
});

app.patch('/api/entities/:entity/:id', requireAuth, async (req, res) => {
  const { entity, id } = req.params;
  let collection;

  try {
    collection = toCollection(entity);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const input = req.body || {};

  let updated = null;

  await writeDb((db) => {
    const index = db[collection].findIndex((item) => item.id === id);
    if (index < 0) return db;

    const current = db[collection][index];
    if (!canAccessRecord(entity, current, req.user)) return db;

    if (req.user.role !== 'admin' && ['Course', 'Assignment', 'Flashcard'].includes(entity)) {
      return db;
    }

    updated = withAuditFields(input, current);
    db[collection][index] = updated;
    return db;
  });

  if (!updated) {
    return res.status(404).json({ message: 'Record not found or forbidden' });
  }

  return res.json(updated);
});

app.delete('/api/entities/:entity/:id', requireAuth, async (req, res) => {
  const { entity, id } = req.params;
  let collection;

  try {
    collection = toCollection(entity);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  let deleted = false;

  await writeDb((db) => {
    const current = db[collection].find((item) => item.id === id);
    if (!current || !canAccessRecord(entity, current, req.user)) {
      return db;
    }
    db[collection] = db[collection].filter((item) => item.id !== id);
    deleted = true;
    return db;
  });

  if (!deleted) {
    return res.status(404).json({ message: 'Record not found or forbidden' });
  }

  return res.status(204).send();
});

app.post('/api/integrations/core/upload-file', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Missing file' });
  }

  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  const contentText = await extractText(req.file.path, req.file.mimetype);

  const stored = withAuditFields({
    uploaded_by: req.user.id,
    name: req.file.originalname,
    mimetype: req.file.mimetype,
    file_url: fileUrl,
    file_path: req.file.path,
    content_text: contentText
  });

  await writeDb((db) => {
    db.uploads.push(stored);
    return db;
  });

  return res.json({ file_url: fileUrl, content_text: contentText });
});

app.post('/api/integrations/core/invoke-llm', requireAuth, async (req, res) => {
  const { prompt = '' } = req.body || {};

  try {
    const response = await invokeOllama({ prompt });
    return res.json({ response });
  } catch {
    return res.json({ response: fallbackAnswer({ question: prompt }) });
  }
});

app.post('/api/chat/respond', requireAuth, async (req, res) => {
  const { course_id, message = '', conversation = [] } = req.body || {};
  if (!course_id || !message.trim()) {
    return res.status(400).json({ message: 'course_id and message are required' });
  }

  const db = await readDb();
  const course = db.courses.find((entry) => entry.id === course_id);

  if (!course) {
    return res.status(404).json({ message: 'Course not found' });
  }

  const hintOnly = Boolean(course?.llm_config?.hint_only_mode);
  const sourceEnriched = (course.content_sources || []).map((source) => {
    const upload = db.uploads.find((u) => u.file_url === source.url);
    return {
      ...source,
      content_text: source.content_text || upload?.content_text || ''
    };
  });

  const rag = buildRagContext({ question: message, sources: sourceEnriched });
  const policyPrompt = buildPolicyPrompt({ course, llmConfig: course.llm_config, mode: hintOnly ? 'hint-only' : 'normal' });
  const history = conversation
    .slice(-12)
    .map((msg) => `${msg.role === 'assistant' ? 'Assistant' : 'Student'}: ${msg.content}`)
    .join('\n');

  const userPrompt = [
    `Student question: ${message}`,
    history ? `Conversation history:\n${history}` : '',
    rag.contextText ? `Relevant course context:\n${rag.contextText}` : 'No matching context found from uploaded sources.',
    'Answer in a pedagogical way and cite which context snippet numbers you used when relevant.'
  ]
    .filter(Boolean)
    .join('\n\n');

  let answer;
  try {
    answer = await invokeOllama({ prompt: userPrompt, systemPrompt: policyPrompt });
  } catch {
    answer = fallbackAnswer({ hintOnly, question: message });
  }

  answer = enforcePolicyOutput({ text: answer, hintOnly });

  return res.json({
    answer,
    citations: rag.snippets.map((snippet, index) => ({
      id: index + 1,
      source: snippet.sourceName,
      score: Number(snippet.score.toFixed(3))
    }))
  });
});

app.post('/api/assignments/:assignmentId/generate-feedback', requireAuth, async (req, res) => {
  const { assignmentId } = req.params;
  const { answers = [] } = req.body || {};

  const db = await readDb();
  const assignment = db.assignments.find((item) => item.id === assignmentId);
  if (!assignment) {
    return res.status(404).json({ message: 'Assignment not found' });
  }

  const course = db.courses.find((item) => item.id === assignment.course_id);
  const llmConfig = course?.llm_config || {};
  const policyPrompt = buildPolicyPrompt({ course, llmConfig, mode: llmConfig.hint_only_mode ? 'hint-only' : 'normal' });

  const questionIds = (assignment.questions || []).map((question) => question.id);

  const payloadPrompt = `Evaluate student submission and return strict JSON only.\n\nAssignment: ${assignment.title}\n\nQuestions: ${JSON.stringify(
    assignment.questions || [],
    null,
    2
  )}\n\nAnswers: ${JSON.stringify(answers, null, 2)}\n\nRequired JSON:\n{\n  \"overall_comment\": \"string\",\n  \"strengths\": [\"string\"],\n  \"improvements\": [\"string\"],\n  \"next_steps\": [\"string\"],\n  \"question_feedback\": [{\"question_id\": \"string\", \"comment\": \"string\", \"score\": 0}]\n}`;

  let feedback;
  try {
    const llmRaw = await invokeOllama({ prompt: payloadPrompt, systemPrompt: policyPrompt, responseFormat: 'json' });
    feedback = parseFeedbackJson(llmRaw, questionIds);
  } catch {
    feedback = fallbackFeedback(questionIds);
  }

  return res.json({ feedback });
});

app.get('/api/dashboard/overview', requireAuth, requireRole('admin'), async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)).getTime() : 0;
  const to = req.query.to ? new Date(String(req.query.to)).getTime() : Date.now() + 24 * 3600_000;

  const db = await readDb();
  const inRange = db.chatSessions.filter((session) => {
    const created = new Date(session.created_date || Date.now()).getTime();
    return created >= from && created <= to;
  });

  const totalMinutes = inRange.reduce((acc, session) => acc + Number(session.duration_minutes || 0), 0);
  const uniqueStudents = new Set(inRange.map((session) => session.student_id)).size;

  return res.json({
    total_sessions: inRange.length,
    total_minutes: totalMinutes,
    unique_students: uniqueStudents,
    average_minutes_per_session: inRange.length ? Number((totalMinutes / inRange.length).toFixed(2)) : 0
  });
});

app.get('/api/dashboard/course/:courseId/time-usage', requireAuth, requireRole('admin'), async (req, res) => {
  const { courseId } = req.params;
  const anonymize = String(req.query.anonymize || 'false') === 'true';

  const db = await readDb();
  const rows = db.chatSessions.filter((session) => session.course_id === courseId);

  const byStudent = new Map();
  for (const row of rows) {
    const prev = byStudent.get(row.student_id) || { minutes: 0, sessions: 0 };
    prev.minutes += Number(row.duration_minutes || 0);
    prev.sessions += 1;
    byStudent.set(row.student_id, prev);
  }

  const result = Array.from(byStudent.entries()).map(([studentId, data]) => {
    const user = db.users.find((entry) => entry.id === studentId);
    return {
      student_id: anonymize ? undefined : studentId,
      student_email: anonymize ? undefined : user?.email,
      sessions: data.sessions,
      minutes: data.minutes
    };
  });

  return res.json({ anonymized: anonymize, rows: result });
});

app.get('/api/gdpr/export/me', requireAuth, async (req, res) => {
  const db = await readDb();
  const userId = req.user.id;
  return res.json({
    user: req.user,
    chatSessions: db.chatSessions.filter((item) => item.student_id === userId),
    submissions: db.submissions.filter((item) => item.student_id === userId),
    enrollments: db.courseEnrollments.filter((item) => item.student_id === userId)
  });
});

app.delete('/api/gdpr/me', requireAuth, async (req, res) => {
  const userId = req.user.id;

  await writeDb((db) => {
    db.chatSessions = db.chatSessions.map((session) =>
      session.student_id === userId
        ? {
            ...session,
            student_id: 'deleted-user',
            student_email: 'deleted@example.com',
            messages: []
          }
        : session
    );

    db.submissions = db.submissions.map((submission) =>
      submission.student_id === userId
        ? {
            ...submission,
            student_id: 'deleted-user',
            student_email: 'deleted@example.com',
            answers: []
          }
        : submission
    );

    db.courseEnrollments = db.courseEnrollments.filter((enrollment) => enrollment.student_id !== userId);
    return db;
  });

  return res.json({ ok: true, message: 'User data anonymized' });
});

app.listen(port, async () => {
  await fs.mkdir(uploadDir, { recursive: true });
  console.log(`Backend listening on http://localhost:${port}`);
});
