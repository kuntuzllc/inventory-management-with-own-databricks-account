import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { logger } from '../config/logger.js';
import { AppError } from '../lib/errors.js';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'Route not found', 'ROUTE_NOT_FOUND'));
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.flatten()
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details
    });
  }

  logger.error(
    {
      err: error,
      path: req.path,
      method: req.method
    },
    'Unhandled request error'
  );

  return res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
}
