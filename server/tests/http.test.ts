import { type AddressInfo } from 'node:net';

import { beforeAll, describe, expect, it } from 'vitest';

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';
process.env['LOG_LEVEL'] = 'silent';
process.env['APP_URL'] = 'http://localhost:3000';
process.env['CLIENT_ORIGINS'] = 'http://localhost:5173';
process.env['DATABASE_URL'] = 'postgres://postgres:postgres@localhost:5432/rag_notebook';

const { buildApp } = await import('../src/index.js');
const {
  CURRENT_CONTRACT_VERSION,
  HealthzResponseSchema,
  ReadyzResponseSchema,
  ContractMetaResponseSchema,
} = await import('../src/contract/index.js');
const { defineRoute } = await import('../src/http/defineRoute.js');
const { AppError, ContractViolationError } = await import('../src/errors/AppError.js');

async function bootHttpServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const app = buildApp();
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}`;
  return {
    url,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

let base: { url: string; close: () => Promise<void> };

beforeAll(async () => {
  base = await bootHttpServer();
  return () => base.close();
});

describe('ops routes', () => {
  it('GET /api/v1/healthz returns a valid envelope', async () => {
    const res = await fetch(`${base.url}/api/v1/healthz`);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Contract-Version')).toBe(CURRENT_CONTRACT_VERSION);
    expect(res.headers.get('X-Request-Id')).toBeTypeOf('string');
    const body = (await res.json()) as { data: unknown };
    HealthzResponseSchema.parse(body.data);
  });

  it('GET /api/v1/readyz reports both db and qdrant checks', async () => {
    const res = await fetch(`${base.url}/api/v1/readyz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    const parsed = ReadyzResponseSchema.parse(body.data);
    expect(parsed.checks.db).not.toBeNull();
    expect(parsed.checks.qdrant).not.toBeNull();
  });

  it('GET /api/v1/_contract returns version + gitSha + generatedAt', async () => {
    const res = await fetch(`${base.url}/api/v1/_contract`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    const parsed = ContractMetaResponseSchema.parse(body.data);
    expect(parsed.version).toBe(CURRENT_CONTRACT_VERSION);
    expect(parsed.gitSha).toBeTypeOf('string');
  });
});

describe('error handling', () => {
  it('an authed route without a session returns UNAUTHENTICATED envelope', async () => {
    const rid = 'test-request-id-xyz';
    const res = await fetch(
      `${base.url}/api/v1/sources/00000000-0000-0000-0000-000000000000/artifacts`,
      {
        headers: { 'X-Request-Id': rid },
      },
    );
    expect(res.status).toBe(401);
    expect(res.headers.get('X-Request-Id')).toBe(rid);
    const body = (await res.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe('UNAUTHENTICATED');
    expect(body.error.requestId).toBe(rid);
  });

  it('404 fallback returns NOT_FOUND envelope', async () => {
    const res = await fetch(`${base.url}/definitely-not-a-route`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; requestId: string } };
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBeTypeOf('string');
  });
});

describe('defineRoute contract enforcement', () => {
  it('ContractViolationError fires when the handler return breaks the response schema (non-prod)', async () => {
    const bad = defineRoute(
      'ops.healthz',

      () =>
        ({ status: 'ok' }) as unknown as { status: 'ok'; version: string; uptimeSeconds: number },
    );

    interface StubReq {
      params: Record<string, string>;
      query: Record<string, string>;
      body: Record<string, unknown>;
      requestId: string;
      log: { info: () => void; warn: () => void; error: () => void };
    }
    interface StubRes {
      status: () => StubRes;
      json: () => StubRes;
    }
    const fakeReq: StubReq = {
      params: {},
      query: {},
      body: {},
      requestId: 'r',
      log: { info: () => undefined, warn: () => undefined, error: () => undefined },
    };
    const fakeRes: StubRes = {
      status: () => fakeRes,
      json: () => fakeRes,
    };
    let capturedError: unknown = null;
    const next = (err?: unknown): void => {
      if (err !== undefined) capturedError = err;
    };

    bad.handler(fakeReq as never, fakeRes as never, next);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(capturedError).toBeInstanceOf(ContractViolationError);
  });

  it('AppError.status maps to ERROR_STATUS entry', () => {
    const e = new AppError('PLAN_LIMIT_EXCEEDED', 'nope');
    expect(e.status).toBe(402);
  });
});
