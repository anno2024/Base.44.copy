import multer from 'multer';
import { Router } from 'express';
import { UserRole } from '@prisma/client';
import type { Env } from '../lib/env.js';
import { authenticate } from '../middleware/auth.js';
import { FileService } from '../services/file-service.js';
import { RagService } from '../services/rag-service.js';
import { LLMService } from '../services/llm-service.js';
import { derivePolicy } from '../services/policy-engine.js';
import { prisma } from '../lib/prisma.js';
import { findCourseFromPrompt } from '../utils/course-context.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export const integrationsRouter = (env: Env) => {
  const router = Router({ mergeParams: true });
  const requireAuth = authenticate(env);
  const ragService = new RagService();
  const fileService = new FileService(env, ragService);
  const llmService = new LLMService(env);

  router.post('/Core/UploadFile', requireAuth, upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'File is required' });
      }
      const stored = await fileService.saveFile(req.file);
      return res.json(stored);
    } catch (error) {
      next(error);
    }
  });

  router.post('/Core/InvokeLLM', requireAuth, async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const { prompt, response_json_schema, course_id } = req.body as {
        prompt?: string;
        response_json_schema?: Record<string, unknown>;
        course_id?: string;
      };
      if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required' });
      }

      let course = course_id
        ? await prisma.course.findFirst({ where: { id: course_id, app_id: env.APP_ID } })
        : await findCourseFromPrompt(env.APP_ID, prompt);

      if (course && req.user.role !== UserRole.admin) {
        const enrollmentCount = await prisma.courseEnrollment.count({
          where: { course_id: course.id, student_id: req.user.id }
        });
        if (enrollmentCount === 0) {
          course = null;
        }
      }

      const policy = derivePolicy(course ?? undefined);
      const ragContext = await ragService.getContext(course?.id ?? null, prompt, 5);
      const llmResult = await llmService.generate({
        prompt,
        course,
        policyInstructions: policy.instructions,
        helpMode: policy.helpMode,
        ragContext,
        responseSchema: response_json_schema
      });

      if (typeof llmResult === 'string') {
        return res.send(llmResult);
      }
      return res.json(llmResult);
    } catch (error) {
      next(error);
    }
  });

  return router;
};
