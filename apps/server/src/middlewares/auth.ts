import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/jwt.js';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authorization = req.header('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Authentication is required', 'AUTH_REQUIRED'));
  }

  const token = authorization.slice('Bearer '.length);

  try {
    req.auth = verifyAccessToken(token);
    return next();
  } catch {
    return next(new AppError(401, 'Invalid or expired token', 'INVALID_TOKEN'));
  }
}
