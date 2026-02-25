import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { Env } from '../lib/env.js';
import { verifyPassword, hashPassword } from '../lib/password.js';
import { signToken } from '../lib/jwt.js';
import { serializeUser } from '../utils/serializers.js';
import { UserRole } from '@prisma/client';

export const authRouter = (env: Env) => {
  const router = Router();

  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const valid = await verifyPassword(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = signToken({ sub: user.id, email: user.email, role: user.role }, env.JWT_SECRET);

      return res.json({
        access_token: token,
        user: serializeUser(user)
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/register', async (req, res, next) => {
    try {
      const { email, password, full_name, role } = req.body as {
        email?: string;
        password?: string;
        full_name?: string;
        role?: UserRole;
      };

      if (!email || !password || !full_name) {
        return res.status(400).json({ message: 'Missing fields' });
      }

      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) {
        return res.status(409).json({ message: 'User already exists' });
      }

      const password_hash = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          email,
          full_name,
          password_hash,
          role: role && Object.values(UserRole).includes(role) ? role : UserRole.student
        }
      });

      const token = signToken({ sub: user.id, email: user.email, role: user.role }, env.JWT_SECRET);

      return res.status(201).json({
        access_token: token,
        user: serializeUser(user)
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', (_req, res) => {
    return res.json({ message: 'Logged out' });
  });

  return router;
};
