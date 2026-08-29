import { type NextFunction, type Request, type RequestHandler, type Response } from 'express';

import { AppError } from '@/errors/AppError.js';
import { logger } from '@/observability/logger.js';

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

const SSE_PATH_SUFFIXES: readonly string[] = ['/messages', '/sources/events'] as const;

function isSseTarget(req: Request): boolean {
  const url = req.originalUrl;
  if (req.method === 'POST' && url.endsWith('/messages')) return true;
  if (req.method === 'GET' && url.endsWith('/sources/events')) return true;

  if (url.startsWith('/api/inngest')) return true;

  return SSE_PATH_SUFFIXES.some((s) => url.endsWith(s) && req.method === 'GET');
}

export function requestTimeoutMiddleware(defaultMs = DEFAULT_REQUEST_TIMEOUT_MS): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (isSseTarget(req)) {
      next();
      return;
    }
    const override: unknown = res.locals['timeoutMs'];
    const budget = typeof override === 'number' ? override : defaultMs;
    const timer = setTimeout(() => {
      if (res.headersSent) return;
      logger.warn(
        {
          event: 'request.timeout',
          method: req.method,
          path: req.originalUrl,
          budgetMs: budget,
        },
        'Request exceeded timeout budget',
      );
      next(
        new AppError('INTERNAL_ERROR', 'Request timed out.', {
          exposeDetails: false,
        }),
      );
    }, budget);
    timer.unref();

    const clear = (): void => {
      clearTimeout(timer);
    };
    res.on('finish', clear);
    res.on('close', clear);
    next();
  };
}
