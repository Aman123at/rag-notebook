import { type AddressInfo } from 'node:net';

import { type Express } from 'express';
import { beforeAll, describe, expect, it } from 'vitest';

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';
process.env['LOG_LEVEL'] = 'silent';
process.env['APP_URL'] = 'http://localhost:3000';
process.env['CLIENT_ORIGINS'] = 'http://localhost:5173';
process.env['DATABASE_URL'] = 'postgres://postgres:postgres@localhost:5432/rag_notebook';
process.env['CLERK_WEBHOOK_SECRET'] = 'whsec_dGVzdC1zZWNyZXQtZm9yLXVuaXQtdGVzdA==';

const { buildApp } = await import('../src/index.js');

async function boot(app: Express): Promise<{ url: string; close: () => Promise<void> }> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

describe('S4 clerk webhook signature verification', () => {
  let base: { url: string; close: () => Promise<void> };

  beforeAll(async () => {
    base = await boot(buildApp());
    return () => base.close();
  });

  it('rejects a tampered svix signature with UNAUTHENTICATED', async () => {
    const body = JSON.stringify({ type: 'user.created', data: { id: 'clerk_x' } });
    const res = await fetch(`${base.url}/api/v1/webhooks/clerk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_1',
        'svix-timestamp': String(Math.floor(Date.now() / 1000)),

        'svix-signature': 'v1,dGFtcGVyZWQtc2lnbmF0dXJl',
      },
      body,
    });
    expect(res.status).toBe(401);
    const parsed = (await res.json()) as { error: { code: string } };
    expect(parsed.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a request missing svix headers with UNAUTHENTICATED', async () => {
    const res = await fetch(`${base.url}/api/v1/webhooks/clerk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(401);
    const parsed = (await res.json()) as { error: { code: string } };
    expect(parsed.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('S4 valid svix signature round-trips', () => {
  it('a Webhook.sign() signed request verifies (positive control for the negative test)', async () => {
    const { Webhook } = await import('svix');

    const secret = process.env['CLERK_WEBHOOK_SECRET'] as string;
    const wh = new Webhook(secret);
    const id = 'msg_positive_control';
    const timestamp = new Date();
    const payload = JSON.stringify({ type: 'not.a.user.event', data: {} });
    const signature = wh.sign(id, timestamp, payload);

    const verified = wh.verify(payload, {
      'svix-id': id,
      'svix-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'svix-signature': signature,
    });
    expect(verified).toBeTypeOf('object');
  });
});
