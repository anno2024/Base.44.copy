import type { NextFunction, Request, Response } from 'express';
import type { Env } from '../lib/env.js';
import { verifyToken } from '../lib/jwt.js';
import type { UserRole } from '@prisma/client';

export const authenticate = (env: Env) => (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const tokenFromQuery = typeof req.query.access_token === 'string' ? req.query.access_token : undefined;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : tokenFromQuery;

  if (!token) {
    return res.status(401).json({ message: 'Missing token' });
  }

  try {
    const payload = verifyToken(token, env.JWT_SECRET);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };
    next();
  } catch (error) {
    console.error('Auth error', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const requireRole = (roles: UserRole | UserRole[]) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};
