import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ApiErrorResponse } from '@shared/api-types';

/**
 * Custom error class for throwing structured HTTP errors from route handlers.
 * The error-handling middleware formats these into a consistent JSON response.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Express error-handling middleware (must have exactly 4 parameters).
 * Catches all errors that reach the middleware stack and responds with
 * a consistent JSON shape. Stack traces are omitted in production.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (res.headersSent) {
    return;
  }

  if (err instanceof AppError) {
    const body: ApiErrorResponse = {
      error: err.message,
      status: err.statusCode,
    };
    if (err.details !== undefined) {
      body.details = err.details;
    }
    res.status(err.statusCode).json(body);
    return;
  }

  const status = 500;
  const body: ApiErrorResponse = {
    error:
      process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : err instanceof Error
          ? err.message
          : 'Internal Server Error',
    status,
  };

  if (process.env.NODE_ENV !== 'production' && err instanceof Error && err.stack) {
    body.details = err.stack;
  }

  res.status(status).json(body);
}

/**
 * Wraps an async Express route handler so that rejected promises
 * are forwarded to the error-handling middleware via next().
 * Required because Express 4 does not catch async rejections automatically.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
