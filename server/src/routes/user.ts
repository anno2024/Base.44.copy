import { Router } from 'express';
import type { Env } from '../lib/env.js';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { serializeUser } from '../utils/serializers.js';

export const userRouter = (env: Env) => {
  const router = Router({ mergeParams: true });
  const requireAuth = authenticate(env);

  router.get('/me', requireAuth, async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      return res.json(serializeUser(user));
    } catch (error) {
      next(error);
    }
  });

  router.put('/me', requireAuth, async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const { full_name } = req.body as { full_name?: string };
      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { full_name: full_name ?? undefined }
      });
      return res.json(serializeUser(user));
    } catch (error) {
      next(error);
    }
  });

  return router;
};
