import type { NextFunction, Request, Response } from 'express';

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  if (res.headersSent) {
    return;
  }

  const status = typeof err === 'object' && err !== null && 'status' in err
    ? Number((err as { status?: number }).status)
    : 500;

  const message = err instanceof Error ? err.message : 'Unexpected error';

  res.status(status || 500).json({
    message,
    status: status || 500
  });
};
