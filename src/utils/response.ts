// src/utils/response.ts
// Standard API response helpers

import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: unknown[];
  meta?: Record<string, unknown>;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: Record<string, unknown>
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    ...(meta ? { meta } : {}),
  };
  res.status(statusCode).json(response);
}

export function sendCreated<T>(res: Response, data: T, message = 'Created'): void {
  sendSuccess(res, data, message, 201);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  errors?: unknown[]
): void {
  const response: ApiResponse = {
    success: false,
    message,
    ...(errors ? { errors } : {}),
  };
  res.status(statusCode).json(response);
}

export function sendNotFound(res: Response, message = 'Resource not found'): void {
  sendError(res, message, 404);
}

export function sendBadRequest(
  res: Response,
  message = 'Bad request',
  errors?: unknown[]
): void {
  sendError(res, message, 400, errors);
}

export function sendUnauthorized(res: Response, message = 'Unauthorized'): void {
  sendError(res, message, 401);
}

export function sendForbidden(res: Response, message = 'Forbidden'): void {
  sendError(res, message, 403);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}
