// src/middleware/validation.middleware.ts
// Centralized Zod validation middleware factory

import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodTypeDef, ZodError } from 'zod';
import { sendBadRequest } from '../utils/response';
import { logger } from '../utils/logger';

export type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Factory function that creates a validation middleware for a given Zod schema.
 * Parses the target (body/query/params), sets the validated + coerced value,
 * and returns 400 with structured errors on failure.
 */
export function validate<T>(
  schema: ZodType<T, ZodTypeDef, unknown>,
  target: ValidationTarget = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parseResult = schema.safeParse(req[target]);

    if (!parseResult.success) {
      const zodError = parseResult.error as ZodError;
      const errors = zodError.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      logger.debug({ errors, target }, 'Validation failed');
      sendBadRequest(res, 'Validation failed', errors);
      return;
    }

    // Replace with validated + coerced data
    (req as unknown as Record<string, unknown>)[target] = parseResult.data;
    next();
  };
}
