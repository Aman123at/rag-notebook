import { randomUUID } from 'node:crypto';

import { type NextFunction, type Request, type Response } from 'express';
import { type HttpLogger, pinoHttp } from 'pino-http';

import { logger } from '@/observability/logger.js';

const HEADER_NAME = 'x-request-id';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
  }
}

export function requestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.header(HEADER_NAME);
    const id = incoming && incoming.trim().length > 0 ? incoming.trim() : randomUUID();
    req.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
  };
}

export function httpLoggerMiddleware(): HttpLogger {
  return pinoHttp({
    logger,
    genReqId: (req) => (req as Request).requestId,
    customProps: (req) => ({ requestId: (req as Request).requestId }),
    autoLogging: {
      ignore: (req) => req.url === '/healthz' || req.url === '/readyz',
    },
  });
}
