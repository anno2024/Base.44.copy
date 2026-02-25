import { Router } from 'express';
import type { Env } from '../lib/env.js';
import { authRouter } from './auth.js';
import { entitiesRouter } from './entities.js';
import { integrationsRouter } from './integrations.js';
import { userRouter } from './user.js';

export const appsRouter = (env: Env) => {
  const router = Router({ mergeParams: true });

  router.use((req, res, next) => {
    if (req.params.appId !== env.APP_ID) {
      return res.status(404).json({ message: 'Unknown app id' });
    }
    next();
  });

  router.use('/auth', authRouter(env));
  router.use('/entities/User', userRouter(env));
  router.use('/entities', entitiesRouter(env));
  router.use('/integration-endpoints', integrationsRouter(env));

  return router;
};
