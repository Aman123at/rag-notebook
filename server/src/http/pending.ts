import { type RequestHandler } from 'express';

import { type ApiError } from '@/contract/index.js';

export function pendingHandler(routeKey: string, phase: string): RequestHandler {
  return (req, res) => {
    const body: ApiError = {
      error: {
        code: 'INTERNAL_ERROR',
        message: `Route ${routeKey} is not implemented yet — scheduled for phase ${phase}.`,
        details: { pending: true, phase, routeKey },
        requestId: req.requestId ?? 'unknown',
      },
    };
    res.status(501).json(body);
  };
}
