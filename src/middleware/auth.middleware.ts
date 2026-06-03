// src/middleware/auth.middleware.ts
// Cognito JWT authentication middleware

import { Request, Response, NextFunction } from 'express';
import { getCognitoVerifier } from '../config/cognito';
import { sendUnauthorized, sendForbidden } from '../utils/response';
import { logger } from '../utils/logger';

// Extend Express Request to include the verified user claims
declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string;
        username: string;
        email?: string;
        groups?: string[];
      };
    }
  }
}

/**
 * Validates the Cognito JWT access token from the Authorization header.
 * Sets req.user with the verified claims on success.
 * When Cognito is not configured (local dev), auth is bypassed with a warning.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const verifier = getCognitoVerifier();

  // If Cognito is not configured (local dev), bypass auth
  if (!verifier) {
    logger.warn('Cognito not configured — bypassing auth (local dev mode)');
    req.user = { sub: 'local-dev', username: 'local-dev' };
    return next();
  }

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      sendUnauthorized(res, 'Authorization header is missing');
      return;
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      sendUnauthorized(res, 'Invalid Authorization header format. Expected: Bearer <token>');
      return;
    }

    // Verify the JWT using aws-jwt-verify (validates signature, expiry, iss, aud)
    const payload = await verifier.verify(token);

    req.user = {
      sub: payload.sub,
      username: (payload['cognito:username'] as string) ?? payload.sub,
      email: payload.email as string | undefined,
      groups: (payload['cognito:groups'] as string[]) ?? [],
    };

    logger.debug({ userId: req.user.sub }, 'User authenticated successfully');
    next();
  } catch (error) {
    logger.warn({ error }, 'JWT verification failed');

    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError' || error.message.includes('expired')) {
        sendUnauthorized(res, 'Token has expired');
        return;
      }
    }

    sendForbidden(res, 'Invalid or expired token');
  }
}

/**
 * Optional auth middleware — attaches user if token present, but doesn't block
 */
export async function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const verifier = getCognitoVerifier();

  if (!verifier) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return next();
  }

  try {
    const payload = await verifier.verify(token);
    req.user = {
      sub: payload.sub,
      username: (payload['cognito:username'] as string) ?? payload.sub,
      email: payload.email as string | undefined,
      groups: (payload['cognito:groups'] as string[]) ?? [],
    };
  } catch {
    // Silently ignore invalid tokens in optional mode
  }

  next();
}
