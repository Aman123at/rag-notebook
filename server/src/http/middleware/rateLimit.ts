import { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { Redis, type RedisOptions } from 'ioredis';

import { env } from '@/config/env.js';
import { AppError } from '@/errors/AppError.js';
import { logger } from '@/observability/logger.js';

export const RATE_LIMIT_CLASSES = [
  'chat',
  'write',
  'read',
  'uploadIntent',
  'coupon',
  'webhook',
] as const;
export type RateLimitClass = (typeof RATE_LIMIT_CLASSES)[number];

interface Budget {
  capacity: number;

  refillPerSecond: number;

  scope: 'user+ip' | 'ip';
}

const BUDGETS: Readonly<Record<RateLimitClass, Budget>> = Object.freeze({
  chat: { capacity: 30, refillPerSecond: 30 / 60, scope: 'user+ip' },
  write: { capacity: 60, refillPerSecond: 60 / 60, scope: 'user+ip' },
  read: { capacity: 300, refillPerSecond: 300 / 60, scope: 'user+ip' },
  uploadIntent: { capacity: 20, refillPerSecond: 20 / 60, scope: 'user+ip' },
  coupon: { capacity: 5, refillPerSecond: 5 / 600, scope: 'user+ip' },
  webhook: { capacity: 240, refillPerSecond: 240 / 60, scope: 'ip' },
});

interface ConsumeResult {
  allowed: boolean;
  remaining: number;

  retryAfterSeconds: number;
}

interface RateLimitBackend {
  consume(bucket: string, budget: Budget, nowMs: number): Promise<ConsumeResult>;

  reset(): Promise<void>;

  close(): Promise<void>;
}

class MemoryBackend implements RateLimitBackend {
  private readonly buckets = new Map<string, { tokens: number; ts: number }>();

  consume(bucket: string, budget: Budget, nowMs: number): Promise<ConsumeResult> {
    const entry = this.buckets.get(bucket) ?? { tokens: budget.capacity, ts: nowMs };
    const elapsedSec = Math.max(0, nowMs - entry.ts) / 1000;
    const refilled = Math.min(budget.capacity, entry.tokens + elapsedSec * budget.refillPerSecond);
    let allowed = false;
    let tokens = refilled;
    if (refilled >= 1) {
      tokens = refilled - 1;
      allowed = true;
    }
    this.buckets.set(bucket, { tokens, ts: nowMs });
    const need = allowed ? 0 : 1 - refilled;
    const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil(need / budget.refillPerSecond));
    return Promise.resolve({ allowed, remaining: Math.floor(tokens), retryAfterSeconds });
  }

  reset(): Promise<void> {
    this.buckets.clear();
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

const CONSUME_LUA = `
local bucket = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local data = redis.call('HMGET', bucket, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then
  tokens = capacity
  ts = now
end

local elapsed = (now - ts) / 1000
if elapsed < 0 then elapsed = 0 end
tokens = tokens + elapsed * refill
if tokens > capacity then tokens = capacity end

local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

redis.call('HMSET', bucket, 'tokens', tokens, 'ts', now)
local ttl = math.ceil(capacity / refill) + 60
redis.call('EXPIRE', bucket, ttl)

local retry = 0
if allowed == 0 then
  local need = 1 - tokens
  retry = math.ceil(need / refill)
  if retry < 1 then retry = 1 end
end

return { allowed, tostring(tokens), retry }
`;

interface RedisWithConsume extends Redis {
  rateLimitConsume(
    bucket: string,
    capacity: number,
    refill: number,
    nowMs: number,
  ): Promise<[number, string, number]>;
}

class RedisBackend implements RateLimitBackend {
  private readonly client: RedisWithConsume;

  constructor(url: string) {
    const opts: RedisOptions = {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    };
    const client = new Redis(url, opts) as RedisWithConsume;
    client.defineCommand('rateLimitConsume', { lua: CONSUME_LUA, numberOfKeys: 1 });
    client.on('error', (err: Error) => {
      logger.warn(
        { event: 'ratelimit.redis.error', err: err.message },
        'Redis error in rate limiter',
      );
    });
    this.client = client;
  }

  async consume(bucket: string, budget: Budget, nowMs: number): Promise<ConsumeResult> {
    try {
      const raw = await this.client.rateLimitConsume(
        bucket,
        budget.capacity,
        budget.refillPerSecond,
        nowMs,
      );
      const allowedFlag = Number(raw[0]);
      const tokens = Number.parseFloat(raw[1]);
      const retry = Number(raw[2]);
      return {
        allowed: allowedFlag === 1,
        remaining: Math.max(0, Math.floor(tokens)),
        retryAfterSeconds: allowedFlag === 1 ? 0 : Math.max(1, retry),
      };
    } catch (err) {
      logger.warn(
        {
          event: 'ratelimit.consume.failed',
          err: err instanceof Error ? err.message : String(err),
          bucket,
        },
        'Rate limit backend failed — falling open',
      );
      return { allowed: true, remaining: budget.capacity, retryAfterSeconds: 0 };
    }
  }

  async reset(): Promise<void> {
    await this.client.flushdb();
  }

  async close(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      // Ignore errors
    }
  }
}

let backend: RateLimitBackend | null = null;

function getBackend(): RateLimitBackend {
  if (backend) return backend;
  if (env.RATE_LIMIT_REDIS_URL) {
    backend = new RedisBackend(env.RATE_LIMIT_REDIS_URL);
    logger.info(
      { event: 'ratelimit.backend', driver: 'redis' },
      'Rate limiter using Redis backend',
    );
  } else {
    backend = new MemoryBackend();
    logger.info(
      { event: 'ratelimit.backend', driver: 'memory' },
      'Rate limiter using in-memory backend — NOT for multi-node production',
    );
  }
  return backend;
}

export async function resetRateLimiterForTests(): Promise<void> {
  if (backend) await backend.close();
  backend = null;
  disabledOverride = null;
}

export async function closeRateLimiter(): Promise<void> {
  if (!backend) return;
  await backend.close();
  backend = null;
}

let disabledOverride: boolean | null = null;

export function setRateLimiterDisabledForTests(value: boolean | null): void {
  disabledOverride = value;
}

function isDisabled(): boolean {
  if (disabledOverride !== null) return disabledOverride;
  if (process.env['RATE_LIMIT_DISABLED'] === '1') return true;

  if (env.NODE_ENV === 'test') return true;
  return false;
}

function clientIp(req: Request): string {
  const forwarded = req.ip;
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded;
  const remote = req.socket.remoteAddress;
  if (typeof remote === 'string' && remote.length > 0) return remote;
  return 'unknown';
}

interface CtxAuth {
  userId: string;
}

function setLimitHeaders(
  res: Response,
  cls: RateLimitClass,
  budget: Budget,
  remaining: number,
  resetSeconds: number,
): void {
  res.setHeader('RateLimit-Limit', budget.capacity);
  res.setHeader('RateLimit-Remaining', Math.max(0, remaining));
  res.setHeader('RateLimit-Reset', Math.max(0, resetSeconds));
  res.setHeader(
    'RateLimit-Policy',
    `${budget.capacity};w=${Math.ceil(budget.capacity / budget.refillPerSecond)};class=${cls}`,
  );
}

export function rateLimit(cls: RateLimitClass): RequestHandler {
  const budget = BUDGETS[cls];
  return (req: Request, res: Response, next: NextFunction): void => {
    if (isDisabled()) {
      next();
      return;
    }
    void (async () => {
      try {
        const nowMs = Date.now();
        const ip = clientIp(req);
        const ctxAuth = (req as unknown as { ctxAuth?: CtxAuth }).ctxAuth;
        const userId = ctxAuth?.userId ?? null;

        const backendImpl = getBackend();

        const keys: Array<{ kind: 'user' | 'ip'; bucket: string }> = [];
        if (budget.scope === 'user+ip' && userId) {
          keys.push({ kind: 'user', bucket: `rl:${cls}:u:${userId}` });
        }
        keys.push({ kind: 'ip', bucket: `rl:${cls}:i:${ip}` });

        const results = await Promise.all(
          keys.map((k) => backendImpl.consume(k.bucket, budget, nowMs)),
        );

        let blockedIdx = -1;
        let worstRemaining = Number.POSITIVE_INFINITY;
        for (let i = 0; i < results.length; i += 1) {
          const r = results[i];
          if (!r) continue;
          if (!r.allowed) {
            const prev = blockedIdx === -1 ? -1 : (results[blockedIdx]?.retryAfterSeconds ?? -1);
            if (r.retryAfterSeconds > prev) blockedIdx = i;
          }
          if (r.remaining < worstRemaining) worstRemaining = r.remaining;
        }
        if (worstRemaining === Number.POSITIVE_INFINITY) {
          next();
          return;
        }

        if (blockedIdx !== -1) {
          const blocked = results[blockedIdx];
          const blockedKey = keys[blockedIdx];
          if (!blocked || !blockedKey) {
            next();
            return;
          }
          setLimitHeaders(res, cls, budget, 0, blocked.retryAfterSeconds);
          res.setHeader('Retry-After', blocked.retryAfterSeconds);
          logger.info(
            {
              event: 'ratelimit.blocked',
              class: cls,
              scope: blockedKey.kind,
              userId,
              ip,
              retryAfterSeconds: blocked.retryAfterSeconds,
            },
            'Request rate limited',
          );
          throw new AppError('RATE_LIMITED', 'Too many requests.', {
            details: {
              retryAfterSeconds: blocked.retryAfterSeconds,
              scope: blockedKey.kind,
              class: cls,
            },
            exposeDetails: true,
          });
        }

        const resetSec = Math.ceil(1 / budget.refillPerSecond);
        setLimitHeaders(res, cls, budget, worstRemaining, resetSec);
        next();
      } catch (err) {
        next(err);
      }
    })();
  };
}
