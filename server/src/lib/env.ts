import path from 'node:path';
import { config as loadDotEnv } from 'dotenv';
import { z } from 'zod';

loadDotEnv({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(4000),
  APP_ID: z.string().min(1),
  DATABASE_URL: z.string().url().or(z.string().startsWith('file:')),
  JWT_SECRET: z.string().min(16),
  BASE_URL: z.string().url().default('http://localhost:4000'),
  FILE_STORAGE_ROOT: z.string().default(path.resolve(process.cwd(), '../storage/uploads')),
  LLM_PROVIDER: z.enum(['mock', 'ollama', 'openai']).default('mock'),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('llama3.1'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  DEFAULT_INSTRUCTOR_EMAIL: z.string().email().default('instructor@example.com'),
  DEFAULT_STUDENT_EMAIL: z.string().email().default('student@example.com')
});

export type Env = z.infer<typeof envSchema>;

export const loadEnv = (): Env => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  return result.data;
};
