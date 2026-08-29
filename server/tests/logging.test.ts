import { describe, expect, it } from 'vitest';

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';
process.env['LOG_LEVEL'] = 'silent';
process.env['APP_URL'] = 'http://localhost:3000';
process.env['CLIENT_ORIGINS'] = 'http://localhost:5173';
process.env['DATABASE_URL'] = 'postgres://postgres:postgres@localhost:5432/rag_notebook';
process.env['CLERK_WEBHOOK_SECRET'] = 'whsec_dGVzdC1zZWNyZXQtZm9yLXVuaXQtdGVzdA==';

const { REDACTED, redactLogRecord } = await import('../src/observability/logger.js');

describe('redactLogRecord', () => {
  it('redacts authorization headers and cookies whatever their casing', () => {
    const out = redactLogRecord({
      req: {
        headers: {
          Authorization: 'Bearer sk-live-abc',
          cookie: '__session=abc',
          'Set-Cookie': '__session=abc',
          'X-Api-Key': 'k-1',
          'user-agent': 'vitest',
        },
      },
    }) as { req: { headers: Record<string, unknown> } };

    expect(out.req.headers['Authorization']).toBe(REDACTED);
    expect(out.req.headers['cookie']).toBe(REDACTED);
    expect(out.req.headers['Set-Cookie']).toBe(REDACTED);
    expect(out.req.headers['X-Api-Key']).toBe(REDACTED);
    expect(out.req.headers['user-agent']).toBe('vitest');
  });

  it.each([
    'token',
    'accessToken',
    'refresh_token',
    'secret',
    'clientSecret',
    'password',
    'apiKey',
    'api_key',
    'api-key',
  ])('redacts the sensitive key %s at any depth', (key) => {
    const out = redactLogRecord({ a: { b: { [key]: 'leaked' } } }) as {
      a: { b: Record<string, unknown> };
    };
    expect(out.a.b[key]).toBe(REDACTED);
  });

  it('leaves non-sensitive fields, arrays and primitives intact', () => {
    const out = redactLogRecord({
      requestId: 'req-1',
      counts: [1, 2, 3],
      nested: [{ userId: 'u1', password: 'p' }],
    }) as { counts: number[]; nested: Array<Record<string, unknown>>; requestId: string };

    expect(out.requestId).toBe('req-1');
    expect(out.counts).toEqual([1, 2, 3]);
    expect(out.nested[0]?.['userId']).toBe('u1');
    expect(out.nested[0]?.['password']).toBe(REDACTED);
  });

  it('does not blow up on a circular record', () => {
    const cyclic: Record<string, unknown> = { name: 'root' };
    cyclic['self'] = cyclic;
    expect(redactLogRecord(cyclic)).toEqual({ name: 'root', self: '[Circular]' });
  });
});
