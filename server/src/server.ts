import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';

import type { Env } from './lib/env.js';
import { appsRouter } from './routes/apps.js';
import { publicRouter } from './routes/public.js';
import { healthRouter } from './routes/health.js';
import { errorHandler } from './middleware/error-handler.js';

export const createServer = (env: Env) => {
  const app = express();
  const storageRoot = path.resolve(env.FILE_STORAGE_ROOT);
  fs.mkdirSync(storageRoot, { recursive: true });

  app.use(cors());
  app.use(helmet());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/files', express.static(storageRoot));
  app.get('/api/apps/auth/logout', (req, res) => {
    const redirectTarget = typeof req.query.from_url === 'string' ? req.query.from_url : '/';
    res.redirect(redirectTarget);
  });
  app.use('/api/health', healthRouter);
  app.use('/api/apps/public', publicRouter(env));
  app.use('/api/apps/:appId', appsRouter(env));

  app.use(errorHandler);

  return app;
};
