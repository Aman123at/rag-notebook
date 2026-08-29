import { type ErrorRequestHandler, type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';

import { type ApiError, ERROR_STATUS, type ErrorCode } from '@/contract/index.js';
import { AppError, ContractViolationError, isAppError } from '@/errors/AppError.js';
import { logger } from '@/observability/logger.js';

function envelope(
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: unknown,
): ApiError {
  const errorPayload: ApiError['error'] = { code, message, requestId };
  if (details !== undefined) errorPayload.details = details;
  return { error: errorPayload };
}

export function errorHandlerMiddleware(): ErrorRequestHandler {
  return (err: unknown, req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent) {
      next(err);
      return;
    }

    const requestId = req.requestId ?? 'unknown';
    const log = req.log ?? logger;

    if (isAppError(err)) {
      const wireMessage = err.code === 'INTERNAL_ERROR' ? 'Internal server error.' : err.message;
      const body = envelope(
        err.code,
        wireMessage,
        requestId,
        err.exposeDetails ? err.details : undefined,
      );
      log.warn(
        { requestId, code: err.code, status: err.status, internalMessage: err.message },
        'AppError',
      );
      res.status(err.status).json(body);
      return;
    }

    if (err instanceof ZodError) {
      const body = envelope('VALIDATION_ERROR', 'Request failed validation.', requestId, {
        issues: err.issues.map((issue) => ({
          path: issue.path.map((p) => String(p)),
          message: issue.message,
          code: issue.code,
        })),
      });
      log.warn({ requestId, issueCount: err.issues.length }, 'VALIDATION_ERROR');
      res.status(ERROR_STATUS.VALIDATION_ERROR).json(body);
      return;
    }

    if (err instanceof ContractViolationError) {
      log.error(
        { requestId, routeKey: err.routeKey, issues: err.issues },
        'ContractViolationError',
      );
      const body = envelope('INTERNAL_ERROR', 'Internal server error.', requestId);
      res.status(ERROR_STATUS.INTERNAL_ERROR).json(body);
      return;
    }

    const stack = err instanceof Error ? err.stack : undefined;
    const cause = err instanceof Error ? err.message : String(err);
    log.error({ requestId, cause, stack }, 'unhandled error at request boundary');
    const body = envelope('INTERNAL_ERROR', 'Internal server error.', requestId);
    res.status(ERROR_STATUS.INTERNAL_ERROR).json(body);
  };
}

export function notFoundHandler() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    next(
      new AppError('NOT_FOUND', `No route matches ${req.method} ${req.originalUrl}`, {
        exposeDetails: false,
      }),
    );
  };
}
