import { type NextFunction, type Request, type RequestHandler, type Response } from 'express';

import { AppError } from '@/errors/AppError.js';

export function bodySizeLimit(maxBytes: number): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers['content-length'];
    if (typeof header !== 'string' || header.length === 0) {
      next();
      return;
    }
    const declared = Number.parseInt(header, 10);
    if (!Number.isFinite(declared)) {
      next();
      return;
    }
    if (declared > maxBytes) {
      next(
        new AppError('PAYLOAD_TOO_LARGE', 'Request body exceeds the per-route limit.', {
          details: { maxBytes, contentLength: declared },
          exposeDetails: true,
        }),
      );
      return;
    }
    next();
  };
}
