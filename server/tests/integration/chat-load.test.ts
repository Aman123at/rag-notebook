import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { performance } from 'node:perf_hooks';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { isDbReachable, resetAndMigrate, TEST_DATABASE_URL } from './setup.js';

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';
process.env['LOG_LEVEL'] = 'silent';
process.env['APP_URL'] = 'http://localhost:3000';
process.env['CLIENT_ORIGINS'] = 'http://localhost:5173';
process.env['DATABASE_URL'] = TEST_DATABASE_URL;

async function* fakeChatStream(): AsyncGenerator<unknown, void, unknown> {
  const tokenCount = 30;
  for (let i = 0; i < tokenCount; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    yield {
      choices: [
        { delta: { content: `t${i} ` }, finish_reason: i === tokenCount - 1 ? 'stop' : null },
      ],
    };
  }

  yield {
    choices: [{ delta: {}, finish_reason: null }],
    usage: { prompt_tokens: 50, completion_tokens: tokenCount, total_tokens: 50 + tokenCount },
  };
}

vi.mock('@/integrations/openai.js', () => ({
  streamChat: (): Promise<AsyncGenerator<unknown, void, unknown>> =>
    Promise.resolve(fakeChatStream()),
  completeChat: (): Promise<unknown> =>
    Promise.resolve({ choices: [{ message: { content: 'x' } }] }),
  estimateEmbeddingTokens: () => 1,
  packEmbeddingBatches: (inputs: string[]) => [inputs],
  embedBatch: (inputs: string[]): Promise<unknown> =>
    Promise.resolve({
      vectors: inputs.map(() => new Array<number>(1536).fill(0)),
      usage: { prompt_tokens: 0, total_tokens: 0 },
      modelUsed: 'text-embedding-3-small',
    }),
  EMBEDDING_LIMITS: {
    maxTokensPerInput: 8192,
    maxTotalTokensPerRequest: 285000,
    maxInputsPerRequest: 2000,
  },
}));

vi.mock('@/retrieval/index.js', () => ({
  retrieve: (): Promise<unknown> =>
    Promise.resolve({
      chunks: [],
      meta: { denseHits: 0, sparseHits: 0, fusedHits: 0, distinctSources: 0, latencyMs: 0 },
    }),
  assemblePrompt: () => ({ systemPrompt: 'test', usedChunks: [], tokensUsed: 0, chunksDropped: 0 }),
  formatLocator: () => '',
  buildDeepLink: () => null,
}));

vi.mock('@/integrations/mem0.js', () => ({
  searchMemories: (): Promise<string[]> => Promise.resolve([]),
  extractMemories: (): Promise<void> => Promise.resolve(),
  neverThrow: (fn: () => Promise<void> | void): void => {
    void Promise.resolve(fn()).catch(() => undefined);
  },
  listMemoriesForUser: (): Promise<unknown[]> => Promise.resolve([]),
  findMemoryForUser: (): Promise<null> => Promise.resolve(null),
  createMemoryForUser: (): Promise<unknown> =>
    Promise.resolve({ id: '', content: '', createdAt: '', updatedAt: '' }),
  updateMemoryForUser: (): Promise<unknown> =>
    Promise.resolve({ id: '', content: '', createdAt: '', updatedAt: '' }),
  deleteMemoryById: (): Promise<void> => Promise.resolve(),
  MemoryStoreUnavailableError: class extends Error {},
}));

vi.mock('@/security/query-guard.js', () => ({
  guardQuery: (): Promise<unknown> =>
    Promise.resolve({ action: 'allow', strike: 0, blocked: false, category: null }),
}));

const reachable = await isDbReachable();
const d = reachable ? describe : describe.skip;

d('S18 — 50 concurrent chat streams', () => {
  let server: Server;
  let baseUrl: string;
  let userId: string;
  let chatId: string;

  beforeAll(async () => {
    await resetAndMigrate();

    const { insertUser } = await import('@/repository/users.repo.js');
    const { insertWorkspace } = await import('@/repository/workspaces.repo.js');
    const { insertChat } = await import('@/repository/chats.repo.js');

    const user = await insertUser({
      clerkUserId: `clerk_load_${randomUUID()}`,
      email: `load-${randomUUID()}@example.com`,
      planTier: 'PRO',
    });
    userId = user.id;
    const ws = await insertWorkspace({ userId: user.id, name: 'load' });
    const chat = await insertChat({ userId: user.id, workspaceId: ws.id, title: 'load' });
    chatId = chat.id;

    const { buildApp } = await import('@/index.js');
    const app = buildApp({
      preRouterMiddleware: (req, _res, next) => {
        const header = req.headers['x-test-user-id'];
        if (typeof header === 'string' && header.length > 0) {
          (req as unknown as { ctxAuth: unknown }).ctxAuth = {
            userId: header,
            clerkUserId: `clerk_${header}`,
            planTier: 'PRO',
            isBlocked: false,
          };
        }
        next();
      },
    });
    server = app.listen(0);
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const { closeDb } = await import('@/db/client.js');
    await closeDb().catch(() => undefined);
  });

  it('measures TTFT and total duration under 50 concurrent streams', async () => {
    const CONCURRENCY = 50;

    async function runOne(): Promise<{ ttftMs: number; totalMs: number; ok: boolean }> {
      const start = performance.now();
      const init: RequestInit = {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': userId,
        },
        body: JSON.stringify({ content: 'hello', webSearch: false }),
      };
      const res = await fetch(`${baseUrl}/chats/${chatId}/messages`, init);
      if (!res.body) {
        return { ttftMs: -1, totalMs: performance.now() - start, ok: false };
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let ttftMs = -1;
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          const bytes = chunk.value as Uint8Array | undefined;
          if (!bytes) continue;
          const text = decoder.decode(bytes);
          if (ttftMs === -1 && /event:\s*token/.test(text)) {
            ttftMs = performance.now() - start;
          }
        }
      } finally {
        reader.releaseLock();
      }
      const totalMs = performance.now() - start;
      return { ttftMs, totalMs, ok: res.status === 200 && ttftMs > 0 };
    }

    const t0 = performance.now();
    const results = await Promise.all(Array.from({ length: CONCURRENCY }, () => runOne()));
    const wallMs = performance.now() - t0;

    const ok = results.filter((r) => r.ok);
    expect(ok.length).toBe(CONCURRENCY);

    const ttfts = ok.map((r) => r.ttftMs).sort((a, b) => a - b);
    const totals = ok.map((r) => r.totalMs).sort((a, b) => a - b);
    const pct = (arr: number[], p: number): number => {
      const idx = Math.min(arr.length - 1, Math.floor((arr.length - 1) * p));
      return arr[idx] ?? -1;
    };

    const summary = {
      concurrency: CONCURRENCY,
      completed: ok.length,
      wallMs: Math.round(wallMs),
      ttft: {
        p50: Math.round(pct(ttfts, 0.5)),
        p95: Math.round(pct(ttfts, 0.95)),
        max: Math.round(ttfts[ttfts.length - 1] ?? -1),
      },
      total: {
        p50: Math.round(pct(totals, 0.5)),
        p95: Math.round(pct(totals, 0.95)),
        max: Math.round(totals[totals.length - 1] ?? -1),
      },
    };

    process.stderr.write(`[S18 chat-load summary] ${JSON.stringify(summary)}\n`);

    expect(summary.ttft.p95).toBeLessThan(2_000);
    expect(summary.total.p95).toBeLessThan(5_000);
  });
});
