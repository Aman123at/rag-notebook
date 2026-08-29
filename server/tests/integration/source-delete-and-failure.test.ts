import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { isDbReachable, resetAndMigrate, TEST_DATABASE_URL } from './setup.js';

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';
process.env['LOG_LEVEL'] = 'silent';
process.env['APP_URL'] = 'http://localhost:3000';
process.env['CLIENT_ORIGINS'] = 'http://localhost:5173';
process.env['DATABASE_URL'] = TEST_DATABASE_URL;
process.env['CLOUDINARY_CLOUD_NAME'] = 'test-cloud';
process.env['CLOUDINARY_API_KEY'] = 'test-key';
process.env['CLOUDINARY_API_SECRET'] = 'test-secret';
process.env['CLOUDINARY_UPLOAD_FOLDER'] = 'rag-notebook';

const reachable = await isDbReachable();
const d = reachable ? describe : describe.skip;

interface SentEvent {
  id?: string;
  name: string;
  data: Record<string, unknown>;
}
const sent: SentEvent[] = [];

vi.mock('../../src/inngest/client.js', async () => {
  const { Inngest } = await import('inngest');
  const client = new Inngest({ id: 'rag-notebook-server-test', isDev: true });
  Object.defineProperty(client, 'send', {
    value: vi.fn((payload: unknown) => {
      const list = Array.isArray(payload) ? payload : [payload];
      for (const p of list) sentSink.push(p as SentEvent);
      return Promise.resolve({ ids: ['stub'] });
    }),
    writable: true,
  });
  return { inngest: client };
});

const sentSink: SentEvent[] = sent;

const clientMod = await import('../../src/db/client.js');
const usersService = await import('../../src/services/users.service.js');
const workspacesService = await import('../../src/services/workspaces.service.js');
const sourceService = await import('../../src/services/source/service.js');
const sourcesRepo = await import('../../src/repository/sources.repo.js');
const workspacesRepo = await import('../../src/repository/workspaces.repo.js');

async function makeUser(): Promise<string> {
  const user = await usersService.provisionOrGetUser({
    clerkUserId: `clerk_s15_${crypto.randomUUID()}`,
    email: `s15+${crypto.randomUUID()}@example.com`,
    displayName: null,
    signUpType: null,
  });
  return user.id;
}

async function makeWorkspace(userId: string): Promise<string> {
  const ws = await workspacesService.createWorkspace(userId, { name: `ws-${crypto.randomUUID()}` });
  return ws.id;
}

function cleanupEventsFor(): SentEvent[] {
  return sent.filter((e) => e.name === 'source/cleanup.requested');
}

beforeAll(async () => {
  if (reachable) await resetAndMigrate();
});
afterAll(async () => {
  await clientMod.closeDb();
});

d('F1 — delete schedules the chunk and vector purge', () => {
  it('publishes source/cleanup.requested for a plain source', async () => {
    sent.length = 0;
    const userId = await makeUser();
    const wsId = await makeWorkspace(userId);
    const src = await sourceService.createSource(userId, wsId, {
      type: 'WEB_URL',
      url: 'https://example.com/a',
    });

    await sourceService.deleteSource(userId, src.id);

    const cleanups = cleanupEventsFor();
    expect(cleanups).toHaveLength(1);
    expect(cleanups[0]?.data).toMatchObject({ sourceId: src.id, userId, workspaceId: wsId });

    expect(cleanups[0]?.id).toBe(`source/cleanup.requested:${src.id}`);
  });

  it('publishes one cleanup per playlist child as well as the parent', async () => {
    sent.length = 0;
    const userId = await makeUser();
    const wsId = await makeWorkspace(userId);
    const parent = await sourceService.createSource(userId, wsId, {
      type: 'YOUTUBE_PLAYLIST',
      url: 'https://www.youtube.com/playlist?list=PLtest12345',
    });
    const children = await Promise.all(
      ['aaa', 'bbb'].map((videoId) =>
        sourcesRepo.insertChildSource({
          userId,
          workspaceId: wsId,
          type: 'YOUTUBE_VIDEO',
          status: 'READY',
          title: `video ${videoId}`,
          originalRef: `https://www.youtube.com/watch?v=${videoId}`,
          mediaId: videoId,
          parentSourceId: parent.id,
        }),
      ),
    );

    await sourceService.deleteSource(userId, parent.id);

    const ids = cleanupEventsFor().map((e) => e.data['sourceId']);
    expect(new Set(ids)).toEqual(new Set([parent.id, ...children.map((c) => c.id)]));
  });

  it('deleting a playlist child does not decrement the workspace counter', async () => {
    sent.length = 0;
    const userId = await makeUser();
    const wsId = await makeWorkspace(userId);
    const parent = await sourceService.createSource(userId, wsId, {
      type: 'YOUTUBE_PLAYLIST',
      url: 'https://www.youtube.com/playlist?list=PLtest67890',
    });
    const child = await sourcesRepo.insertChildSource({
      userId,
      workspaceId: wsId,
      type: 'YOUTUBE_VIDEO',
      status: 'READY',
      title: 'child',
      originalRef: 'https://www.youtube.com/watch?v=ccc',
      mediaId: 'ccc',
      parentSourceId: parent.id,
      chunkCount: 7,
    });

    const before = await workspacesRepo.findWorkspaceForUser(userId, wsId);
    await sourceService.deleteSource(userId, child.id);
    const after = await workspacesRepo.findWorkspaceForUser(userId, wsId);

    expect(after?.sourceCount).toBe(before?.sourceCount);

    const parentRow = await sourcesRepo.findSourceForUser(userId, parent.id);
    expect(parentRow?.chunkCount).toBe(0);
  });
});

d('F5 — sources.list inlines the failure object', () => {
  it('carries code, message and retryable for a FAILED row', async () => {
    const userId = await makeUser();
    const wsId = await makeWorkspace(userId);
    const src = await sourceService.createSource(userId, wsId, {
      type: 'WEB_URL',
      url: 'https://example.com/fails',
    });
    await sourcesRepo.updateSourceStatus(src.id, {
      status: 'FAILED',
      failureCode: 'INTERNAL_ERROR',
      failureMessage: 'Video is unavailable, removed, or does not exist.',
      failureRetryable: false,
    });

    const list = await sourceService.listSources(userId, wsId);
    const row = list.find((s) => s.id === src.id);

    expect(row?.failure).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Video is unavailable, removed, or does not exist.',
      retryable: false,
    });
  });

  it('omits failure for a healthy row', async () => {
    const userId = await makeUser();
    const wsId = await makeWorkspace(userId);
    const src = await sourceService.createSource(userId, wsId, {
      type: 'WEB_URL',
      url: 'https://example.com/ok',
    });

    const list = await sourceService.listSources(userId, wsId);
    expect(list.find((s) => s.id === src.id)?.failure).toBeUndefined();
  });
});
