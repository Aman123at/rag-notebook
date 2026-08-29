import pino, { type Logger } from 'pino';

import { env } from '@/config/env.js';

const SENSITIVE_KEY_RE = /token|secret|password|api[-_]?key/i;
const HEADER_KEY_BLOCKLIST = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key']);
export const REDACTED = '[REDACTED]' as const;

function redactRecord(input: unknown, seen: WeakSet<object>): unknown {
  if (input === null) return input;
  if (Array.isArray(input)) return input.map((v) => redactRecord(v, seen));
  if (typeof input !== 'object') return input;
  if (seen.has(input)) return '[Circular]';
  seen.add(input);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEY_RE.test(k) || HEADER_KEY_BLOCKLIST.has(k.toLowerCase())) {
      out[k] = REDACTED;
    } else {
      out[k] = redactRecord(v, seen);
    }
  }
  return out;
}

export function redactLogRecord(record: unknown): unknown {
  return redactRecord(record, new WeakSet<object>());
}

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
];

export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'api' },
  redact: { paths: REDACT_PATHS, censor: REDACTED, remove: false },
  formatters: {
    log(record) {
      return redactLogRecord(record) as Record<string, unknown>;
    },
  },
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
        },
      }
    : {}),
});
