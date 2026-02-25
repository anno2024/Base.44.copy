import type { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface UserClaims {
      id: string;
      email: string;
      role: UserRole;
    }

    interface Request {
      user?: UserClaims;
    }
  }
}

export {};
