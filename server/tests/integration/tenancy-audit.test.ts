import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { type AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { isDbReachable, resetAndMigrate, TEST_DATABASE_URL } from './setup.js';

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';
process.env['LOG_LEVEL'] = 'silent';
process.env['APP_URL'] = 'http://localhost:3000';
process.env['CLIENT_ORIGINS'] = 'http://localhost:5173';
process.env['DATABASE_URL'] = TEST_DATABASE_URL;

const mem0Store = new Map<string, string>();

interface MemRecord {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}
const stampIso = '2026-08-26T00:00:00.000Z';
vi.mock('@/integrations/mem0.js', () => {
  const listMemoriesForUser = (): Promise<MemRecord[]> => Promise.resolve([]);
  const findMemoryForUser = (userId: string, memoryId: string): Promise<MemRecord | null> => {
    const owner = mem0Store.get(memoryId);
    if (!owner || owner !== userId) return Promise.resolve(null);
    return Promise.resolve({
      id: memoryId,
      content: 'test memory',
      createdAt: stampIso,
      updatedAt: stampIso,
    });
  };
  const createMemoryForUser = (userId: string, content: string): Promise<MemRecord> => {
    const id = randomUUID();
    mem0Store.set(id, userId);
    return Promise.resolve({ id, content, createdAt: stampIso, updatedAt: stampIso });
  };
  const updateMemoryForUser = (
    _userId: string,
    memoryId: string,
    content: string,
  ): Promise<MemRecord> =>
    Promise.resolve({ id: memoryId, content, createdAt: stampIso, updatedAt: stampIso });
  const deleteMemoryById = (memoryId: string): Promise<void> => {
    mem0Store.delete(memoryId);
    return Promise.resolve();
  };
  const noop = (): void => undefined;
  return {
    listMemoriesForUser,
    findMemoryForUser,
    createMemoryForUser,
    updateMemoryForUser,
    deleteMemoryById,

    searchMemories: (): Promise<string[]> => Promise.resolve([]),
    extractMemories: (): Promise<void> => Promise.resolve(),
    neverThrow: (fn: () => Promise<void> | void): void => {
      try {
        void Promise.resolve(fn()).catch(noop);
      } catch {
        // Ignore errors
      }
    },
    MemoryStoreUnavailableError: class extends Error {},
  };
});

const reachable = await isDbReachable();
const d = reachable ? describe : describe.skip;

d('S18 — tenancy and workspace-isolation audit', () => {
  let server: Server;
  let baseUrl: string;

  let userA: { id: string };
  let userB: { id: string };
  let wsA1: { id: string };
  let wsA2: { id: string };
  let wsB1: { id: string };
  let sourceA1: { id: string; workspaceId: string };
  let sourceB1: { id: string; workspaceId: string };
  let chatA1: { id: string; workspaceId: string };
  let chatB1: { id: string; workspaceId: string };
  let messageA: { id: string };
  let artifactA: { id: string };
  let memoryA: string;
  let memoryB: string;

  beforeAll(async () => {
    await resetAndMigrate();

    const { insertUser } = await import('@/repository/users.repo.js');
    const { insertWorkspace } = await import('@/repository/workspaces.repo.js');
    const { insertSourceAndBumpCounter } = await import('@/repository/sources.repo.js');
    const { insertChat } = await import('@/repository/chats.repo.js');
    const { insertMessage } = await import('@/repository/messages.repo.js');
    const { insertArtifact } = await import('@/repository/artifacts.repo.js');
    const { chunkId } = await import('@/db/chunk-id.js');

    userA = await insertUser({
      clerkUserId: `clerk_a_${randomUUID()}`,
      email: `a-${randomUUID()}@example.com`,
      planTier: 'FREE',
    });
    userB = await insertUser({
      clerkUserId: `clerk_b_${randomUUID()}`,
      email: `b-${randomUUID()}@example.com`,
      planTier: 'FREE',
    });

    wsA1 = await insertWorkspace({ userId: userA.id, name: 'A-1' });
    wsA2 = await insertWorkspace({ userId: userA.id, name: 'A-2' });
    wsB1 = await insertWorkspace({ userId: userB.id, name: 'B-1' });

    sourceA1 = await insertSourceAndBumpCounter({
      userId: userA.id,
      workspaceId: wsA1.id,
      type: 'TEXT',
      title: 'A1 source',
      originalRef: 'test://a1',
      status: 'READY',
    });
    sourceB1 = await insertSourceAndBumpCounter({
      userId: userB.id,
      workspaceId: wsB1.id,
      type: 'TEXT',
      title: 'B1 source',
      originalRef: 'test://b1',
      status: 'READY',
    });

    chatA1 = await insertChat({ userId: userA.id, workspaceId: wsA1.id, title: 'A chat' });
    chatB1 = await insertChat({ userId: userB.id, workspaceId: wsB1.id, title: 'B chat' });

    messageA = await insertMessage({
      chatId: chatA1.id,
      userId: userA.id,
      role: 'assistant',
      content: 'A msg',
      modelName: 'gpt-4o-mini',
      consumedTokens: 0,
    });
    await insertMessage({
      chatId: chatB1.id,
      userId: userB.id,
      role: 'assistant',
      content: 'B msg',
      modelName: 'gpt-4o-mini',
      consumedTokens: 0,
    });

    artifactA = await insertArtifact({
      userId: userA.id,
      sourceId: sourceA1.id,
      type: 'PLAYLIST_ROADMAP',
      status: 'READY',
      content: { overview: 'x', totalMinutes: 0, difficulty: 'BEGINNER', modules: [] },
    });
    await insertArtifact({
      userId: userB.id,
      sourceId: sourceB1.id,
      type: 'PLAYLIST_ROADMAP',
      status: 'READY',
      content: { overview: 'x', totalMinutes: 0, difficulty: 'BEGINNER', modules: [] },
    });

    memoryA = randomUUID();
    mem0Store.set(memoryA, userA.id);
    memoryB = randomUUID();
    mem0Store.set(memoryB, userB.id);

    void chunkId;

    const { buildApp } = await import('@/index.js');
    const app = buildApp({
      preRouterMiddleware: (req, _res, next) => {
        const header = req.headers['x-test-user-id'];
        if (typeof header === 'string' && header.length > 0) {
          (req as unknown as { ctxAuth: unknown }).ctxAuth = {
            userId: header,
            clerkUserId: `clerk_${header}`,
            planTier: 'FREE',
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

  beforeEach(() => {
    mem0Store.clear();
    mem0Store.set(memoryA, userA.id);
    mem0Store.set(memoryB, userB.id);
  });

  interface IdSubs {
    workspaceId?: string;
    sourceId?: string;
    chatId?: string;
    messageId?: string;
    memoryId?: string;
    artifactId?: string;
  }

  function bodyFor(routeKey: string): unknown {
    switch (routeKey) {
      case 'identity.updateMe':
        return { displayName: 'test' };
      case 'workspaces.create':
        return { name: 'x' };
      case 'workspaces.update':
        return { name: 'renamed' };
      case 'sources.uploadIntent':
        return { fileName: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 1 };
      case 'sources.create':
        return { type: 'WEB_URL', url: 'https://example.com/a' };
      case 'chats.create':
        return { title: 'x' };
      case 'chats.update':
        return { title: 'renamed' };
      case 'chats.sendMessage':
        return { content: 'hi', webSearch: false };
      case 'messages.reaction':
        return { reaction: 'like' };
      case 'memories.create':
        return { content: 'x' };
      case 'memories.update':
        return { content: 'x' };
      case 'billing.checkout':
        return { planTier: 'PRO' };
      case 'billing.redeemCoupon':
        return { code: 'x' };
      case 'artifacts.create':
        return {};
      default:
        return {};
    }
  }

  function fillPath(path: string, subs: IdSubs): string {
    return path
      .replace(':workspaceId', subs.workspaceId ?? randomUUID())
      .replace(':sourceId', subs.sourceId ?? randomUUID())
      .replace(':chatId', subs.chatId ?? randomUUID())
      .replace(':messageId', subs.messageId ?? randomUUID())
      .replace(':memoryId', subs.memoryId ?? randomUUID())
      .replace(':artifactId', subs.artifactId ?? randomUUID());
  }

  function queryFor(routeKey: string): string {
    switch (routeKey) {
      case 'sources.preview':
        return `?chunkId=${randomUUID()}`;
      default:
        return '';
    }
  }

  async function call(
    method: string,
    path: string,
    userId: string,
    body?: unknown,
  ): Promise<{ status: number; json: unknown }> {
    const init: RequestInit = {
      method,
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': userId,
      },
    };
    if (method !== 'GET' && method !== 'DELETE') {
      init.body = JSON.stringify(body ?? {});
    }
    const res = await fetch(`${baseUrl}${path}`, init);

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return { status: res.status, json: await res.json() };
    }

    await res.body?.cancel().catch(() => undefined);
    return { status: res.status, json: null };
  }

  function subsFromA(): IdSubs {
    return {
      workspaceId: wsA1.id,
      sourceId: sourceA1.id,
      chatId: chatA1.id,
      messageId: messageA.id,
      memoryId: memoryA,
      artifactId: artifactA.id,
    };
  }

  it('every authed route with a resource id in its path returns NOT_FOUND across tenants', async () => {
    const { routeRegistry } = await import('@/contract/index.js');

    const results: Array<{
      routeKey: string;
      method: string;
      path: string;
      status: number;
      body: unknown;
    }> = [];

    for (const [routeKey, def] of Object.entries(routeRegistry)) {
      if (def.auth !== 'required') continue;

      const hasResourceId =
        def.path.includes(':workspaceId') ||
        def.path.includes(':sourceId') ||
        def.path.includes(':chatId') ||
        def.path.includes(':messageId') ||
        def.path.includes(':memoryId') ||
        def.path.includes(':artifactId');
      if (!hasResourceId) continue;

      const path = fillPath(def.path, subsFromA()) + queryFor(routeKey);
      const body = bodyFor(routeKey);
      const { status, json } = await call(def.method, path, userB.id, body);

      results.push({ routeKey, method: def.method, path, status, body: json });

      const envelope = (json as { error?: { code?: string } } | null) ?? null;
      expect(
        {
          routeKey,
          method: def.method,
          path,
          status,
          errorCode: envelope?.error?.code ?? null,
        },
        `route ${routeKey} leaked cross-tenant access`,
      ).toMatchObject({
        status: 404,
        errorCode: 'NOT_FOUND',
      });
    }

    expect(results.length).toBeGreaterThanOrEqual(15);
  });

  it('workspace-scoped lists cannot see resources from another workspace of the same user', async () => {
    const list1 = await call('GET', `/workspaces/${wsA2.id}/sources`, userA.id);
    expect(list1.status).toBe(200);
    const data1 = (list1.json as { data?: Array<{ id: string }> }).data ?? [];
    expect(data1.every((s) => s.id !== sourceA1.id)).toBe(true);

    const list2 = await call('GET', `/workspaces/${wsA2.id}/chats`, userA.id);
    expect(list2.status).toBe(200);
    const data2 = (list2.json as { data?: Array<{ id: string }> }).data ?? [];
    expect(data2.every((c) => c.id !== chatA1.id)).toBe(true);
  });

  it('workspace-scoped routes reject userA hitting wsB', async () => {
    const r1 = await call('GET', `/workspaces/${wsB1.id}/sources`, userA.id);
    expect(r1.status).toBe(404);

    const r2 = await call('GET', `/workspaces/${wsB1.id}/chats`, userA.id);
    expect(r2.status).toBe(404);

    const r3 = await call('POST', `/workspaces/${wsB1.id}/sources`, userA.id, {
      type: 'WEB_URL',
      url: 'https://example.com/leak',
    });
    expect(r3.status).toBe(404);
  });

  it('same user hits their own resource successfully (positive control)', async () => {
    const r = await call('GET', `/workspaces/${wsA1.id}`, userA.id);
    expect(r.status).toBe(200);
    const data = (r.json as { data?: { id: string } }).data;
    expect(data?.id).toBe(wsA1.id);
  });
});
