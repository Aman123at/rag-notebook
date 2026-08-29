import { type NextFunction, type Request, type Response } from 'express';

import { CURRENT_CONTRACT_VERSION } from '@/contract/index.js';

const HEADER_NAME = 'X-Contract-Version';

export function contractVersionMiddleware() {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader(HEADER_NAME, CURRENT_CONTRACT_VERSION);
    next();
  };
}
