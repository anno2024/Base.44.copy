import { Router } from 'express';
import type { Env } from '../lib/env.js';
import { getPublicSettingsResponse } from '../config/app-settings.js';

export const publicRouter = (env: Env) => {
  const router = Router();

  router.get('/prod/public-settings/by-id/:appId', (req, res) => {
    if (req.params.appId !== env.APP_ID) {
      return res.status(404).json({ message: 'App not found' });
    }

    return res.json(getPublicSettingsResponse(env));
  });

  return router;
};
