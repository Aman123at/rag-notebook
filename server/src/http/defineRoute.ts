import { type Request, type RequestHandler, type Response } from 'express';
import { type Logger } from 'pino';
import { type z } from 'zod';

import { env } from '@/config/env.js';
import {
  type ErrorCode,
  ok,
  type PlanTier,
  type RouteDefinition,
  type RouteKey,
  type RouteRegistry,
  routeRegistry,
} from '@/contract/index.js';
import { AppError, ContractViolationError } from '@/errors/AppError.js';
import { readPaginationMeta } from '@/http/pagination.js';

export interface AuthContext {
  userId: string;

  clerkUserId: string;

  planTier: PlanTier;

  isBlocked: boolean;
}

type CtxAuth<R extends RouteDefinition> = R['auth'] extends 'required' ? AuthContext : never;

export type RouteHandlerContext<R extends RouteDefinition> = {
  params: z.infer<R['params']>;
  query: z.infer<R['query']>;
  body: z.infer<R['body']>;
  req: Request;
  res: Response;
  log: Logger;
  requestId: string;
} & (R['auth'] extends 'required' ? { auth: CtxAuth<R> } : { auth?: never });

export type RouteHandler<R extends RouteDefinition> = (
  ctx: RouteHandlerContext<R>,
) => Promise<z.infer<R['response']>> | z.infer<R['response']>;

export type SseRouteHandler<R extends RouteDefinition> = (
  ctx: RouteHandlerContext<R>,
) => Promise<void> | void;

export interface DefinedRoute<K extends RouteKey = RouteKey> {
  key: K;
  def: RouteRegistry[K];
  handler: RequestHandler;
}

function toAppErrorFromAuth(code: ErrorCode, msg: string): AppError {
  return new AppError(code, msg, { exposeDetails: false });
}

export function defineRoute<K extends RouteKey>(
  key: K,
  handler: RouteHandler<RouteRegistry[K]>,
): DefinedRoute<K> {
  const def = routeRegistry[key];

  const requestHandler: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const ctxAuth = (req as unknown as { ctxAuth?: AuthContext }).ctxAuth;

        if (def.auth === 'required' && ctxAuth == null) {
          throw toAppErrorFromAuth('UNAUTHENTICATED', 'Authentication is required for this route.');
        }

        const params = def.params.parse(req.params) as z.infer<RouteRegistry[K]['params']>;
        const query = def.query.parse(req.query) as z.infer<RouteRegistry[K]['query']>;
        const body = def.body.parse(req.body ?? {}) as z.infer<RouteRegistry[K]['body']>;

        const ctx = {
          params,
          query,
          body,
          req,
          res,
          log: req.log,
          requestId: req.requestId,
          ...(ctxAuth ? { auth: ctxAuth } : {}),
        } as RouteHandlerContext<RouteRegistry[K]>;

        const data = await handler(ctx);

        if (env.NODE_ENV !== 'production') {
          const check = def.response.safeParse(data);
          if (!check.success) {
            throw new ContractViolationError(key, check.error.issues);
          }
        }

        const status = def.successStatus ?? 200;
        const meta = readPaginationMeta(res);
        res.status(status).json(ok(data, meta));
      } catch (err) {
        next(err);
      }
    })();
  };

  return { key, def: def, handler: requestHandler };
}

export function defineSseRoute<K extends RouteKey>(
  key: K,
  handler: SseRouteHandler<RouteRegistry[K]>,
): DefinedRoute<K> {
  const def = routeRegistry[key];
  if (def.responseContentType !== 'text/event-stream') {
    throw new Error(
      `defineSseRoute called for ${key}, but its registry entry is not text/event-stream. ` +
        'Use defineRoute for JSON responses.',
    );
  }

  const requestHandler: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const ctxAuth = (req as unknown as { ctxAuth?: AuthContext }).ctxAuth;
        if (def.auth === 'required' && ctxAuth == null) {
          throw toAppErrorFromAuth('UNAUTHENTICATED', 'Authentication is required for this route.');
        }
        const params = def.params.parse(req.params) as z.infer<RouteRegistry[K]['params']>;
        const query = def.query.parse(req.query) as z.infer<RouteRegistry[K]['query']>;
        const body = def.body.parse(req.body ?? {}) as z.infer<RouteRegistry[K]['body']>;
        const ctx = {
          params,
          query,
          body,
          req,
          res,
          log: req.log,
          requestId: req.requestId,
          ...(ctxAuth ? { auth: ctxAuth } : {}),
        } as RouteHandlerContext<RouteRegistry[K]>;
        await handler(ctx);
      } catch (err) {
        next(err);
      }
    })();
  };

  return { key, def: def, handler: requestHandler };
}
