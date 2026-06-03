// src/middleware/error.middleware.ts
// Global error handler middleware

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown[];
}

/**
 * Global express error handling middleware.
 * Must have 4 parameters to be recognized by Express as error middleware.
 */
export function errorMiddleware(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the error
  logger.error(
    {
      err,
      method: req.method,
      path: req.path,
      requestId: req.headers['x-request-id'],
    },
    'Unhandled error'
  );

  // Handle Zod validation errors
  if ((err as unknown) instanceof ZodError) {
    const zodErr = err as unknown as ZodError;
    const errors = zodErr.errors.map((e: { path: (string | number)[]; message: string }) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 'Validation failed', 400, errors);
    return;
  }

  // Handle DynamoDB ConditionalCheckFailedException
  if (err.name === 'ConditionalCheckFailedException') {
    sendError(res, 'Resource conflict or not found', 409);
    return;
  }

  // Handle AWS service errors
  if (err.name === 'ServiceUnavailableException') {
    sendError(res, 'Service temporarily unavailable', 503);
    return;
  }

  // Handle known HTTP status code errors
  if (err.statusCode) {
    sendError(res, err.message, err.statusCode, err.details);
    return;
  }

  // Default to 500
  sendError(
    res,
    process.env['NODE_ENV'] === 'production'
      ? 'Internal server error'
      : (err.message ?? 'Internal server error'),
    500
  );
}

/**
 * 404 Not Found handler for unknown routes
 */
export function notFoundMiddleware(req: Request, res: Response): void {
  sendError(res, `Route ${req.method} ${req.path} not found`, 404);
}
