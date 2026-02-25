import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export const signToken = (payload: JwtPayload, secret: string, expiresIn = '12h'): string => {
  return jwt.sign(payload, secret, { expiresIn });
};

export const verifyToken = (token: string, secret: string): JwtPayload => {
  const decoded = jwt.verify(token, secret);
  if (typeof decoded === 'string') {
    throw new Error('Unexpected token payload');
  }
  return decoded as JwtPayload;
};
