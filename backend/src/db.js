import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DB_PATH = path.resolve(process.cwd(), "data/db.json");
const DB_DIR = path.dirname(DB_PATH);
const WRITE_RETRY_DELAY_MS = Number(process.env.DB_WRITE_RETRY_MS || 40);
const WRITE_RETRY_MAX_ATTEMPTS = Number(
  process.env.DB_WRITE_RETRY_ATTEMPTS || 8,
);

function createInitialData() {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: "u-instructor",
        email: "teacher@example.com",
        full_name: "Instructor Demo",
        role: "admin",
        token: "instructor-token",
        created_date: now,
      },
      {
        id: "u-student",
        email: "student@example.com",
        full_name: "Student Demo",
        role: "student",
        token: "student-token",
        created_date: now,
      },
    ],
    courses: [],
    courseEnrollments: [],
    chatSessions: [],
    assignments: [],
    flashcards: [],
    uploads: [],
    appLogs: [],
    ragChunks: [],
  };
}

function normalizeDbShape(db) {
  const base = createInitialData();
  return {
    ...base,
    ...db,
    users: Array.isArray(db?.users) ? db.users : base.users,
    courses: Array.isArray(db?.courses) ? db.courses : [],
    courseEnrollments: Array.isArray(db?.courseEnrollments)
      ? db.courseEnrollments
      : [],
    chatSessions: Array.isArray(db?.chatSessions) ? db.chatSessions : [],
    assignments: Array.isArray(db?.assignments) ? db.assignments : [],
    flashcards: Array.isArray(db?.flashcards) ? db.flashcards : [],
    uploads: Array.isArray(db?.uploads) ? db.uploads : [],
    appLogs: Array.isArray(db?.appLogs) ? db.appLogs : [],
    ragChunks: Array.isArray(db?.ragChunks) ? db.ragChunks : [],
  };
}

async function writeDbFileAtomically(data) {
  await fs.mkdir(DB_DIR, { recursive: true });
  const tempPath = path.join(DB_DIR, `db.${Date.now()}.tmp`);
  const payload = JSON.stringify(data, null, 2);
  await fs.writeFile(tempPath, payload, "utf-8");

  let lastError = null;
  for (let attempt = 1; attempt <= WRITE_RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      await fs.rename(tempPath, DB_PATH);
      return;
    } catch (error) {
      lastError = error;
      const isRetryable =
        error?.code === "EPERM" ||
        error?.code === "EBUSY" ||
        error?.code === "EACCES";

      if (!isRetryable || attempt === WRITE_RETRY_MAX_ATTEMPTS) {
        break;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, WRITE_RETRY_DELAY_MS * attempt),
      );
    }
  }

  try {
    // Windows can temporarily lock rename target; direct write is safer fallback.
    await fs.writeFile(DB_PATH, payload, "utf-8");
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }

  if (lastError) {
    console.warn(
      `[db] Atomic rename failed, used direct write fallback (${lastError.code || "unknown"})`,
    );
  }
}

const entityMap = {
  Course: "courses",
  CourseEnrollment: "courseEnrollments",
  ChatSession: "chatSessions",
  Assignment: "assignments",
  Flashcard: "flashcards",
};

let writeQueue = Promise.resolve();

async function ensureDb() {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.mkdir(DB_DIR, { recursive: true });
    await writeDbFileAtomically(createInitialData());
  }
}

export async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(DB_PATH, "utf-8");

  try {
    return normalizeDbShape(JSON.parse(raw));
  } catch {
    const corruptBackupPath = path.join(
      DB_DIR,
      `db.corrupt.${Date.now()}.json`,
    );
    await fs.writeFile(corruptBackupPath, raw, "utf-8");

    const repaired = createInitialData();
    await writeDbFileAtomically(repaired);
    return repaired;
  }
}

export async function writeDb(updater) {
  writeQueue = writeQueue
    .catch(() => null)
    .then(async () => {
      const current = await readDb();
      const next = await updater(current);
      const normalized = normalizeDbShape(next);
      await writeDbFileAtomically(normalized);
      return normalized;
    });
  return writeQueue;
}

export function toCollection(entityName) {
  const collection = entityMap[entityName];
  if (!collection) {
    throw new Error(`Unknown entity: ${entityName}`);
  }
  return collection;
}

export function withAuditFields(input, existing = null) {
  const now = new Date().toISOString();
  if (!existing) {
    return {
      id: randomUUID(),
      created_date: now,
      updated_date: now,
      ...input,
    };
  }
  return {
    ...existing,
    ...input,
    id: existing.id,
    created_date: existing.created_date,
    updated_date: now,
  };
}

export function pickUserFromToken(db, token) {
  if (!token) return null;
  return (
    db.users.find((user) => user.token === token || user.id === token) ?? null
  );
}

export function applySort(items, sort = "") {
  if (!sort) return [...items];
  const desc = sort.startsWith("-");
  const key = desc ? sort.slice(1) : sort;
  return [...items].sort((a, b) => {
    const left = a?.[key];
    const right = b?.[key];
    if (left === right) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return desc ? (left < right ? 1 : -1) : left < right ? -1 : 1;
  });
}

export function applyFilter(items, filter = {}) {
  const entries = Object.entries(filter).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  if (entries.length === 0) return [...items];
  return items.filter((item) =>
    entries.every(([key, value]) => {
      if (Array.isArray(value)) {
        return value.includes(item[key]);
      }
      return item[key] === value;
    }),
  );
}

export function parseJsonParam(value, fallback = {}) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
