import { EventEmitter } from 'node:events';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('../../src/integrations/cloudinary.js', () => {
  const state: { existingIds: Set<string> } = { existingIds: new Set() };
  return {
    _state: state,
    buildUploadSignature: (publicId: string) => ({
      uploadUrl: 'https://api.cloudinary.com/v1_1/test-cloud/raw/upload',
      publicId,
      timestamp: 1_700_000_000,
      signature: 'stubbed-signature',
      apiKey: 'test-key',
      resourceType: 'raw',
      expiresAt: new Date().toISOString(),
    }),
    buildSignedDownloadUrl: (publicId: string) => ({
      url: `https://res.cloudinary.com/test/raw/authenticated/s--sig--/${publicId}`,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    }),
    fetchAssetMetadata: (publicId: string) =>
      Promise.resolve(
        state.existingIds.has(publicId)
          ? { publicId, bytes: 1234, format: 'pdf', resourceType: 'raw', type: 'authenticated' }
          : null,
      ),
  };
});

vi.mock('../../src/inngest/client.js', async () => {
  const { Inngest } = await import('inngest');
  const client = new Inngest({ id: 'rag-notebook-server-test', isDev: true });
  Object.defineProperty(client, 'send', {
    value: vi.fn(() => Promise.resolve({ ids: ['stub'] })),
    writable: true,
  });
  return { inngest: client };
});

const clientMod = await import('../../src/db/client.js');
const usersService = await import('../../src/services/users.service.js');
const workspacesService = await import('../../src/services/workspaces.service.js');
const sourceService = await import('../../src/services/source/service.js');
const sourceEvents = await import('../../src/services/source/events.js');
const uploadValidation = await import('../../src/services/source/upload-validation.js');
const cloudinaryStub = (await import('../../src/integrations/cloudinary.js')) as unknown as {
  _state: { existingIds: Set<string> };
};
const { AppError } = await import('../../src/errors/AppError.js');

async function makeUser(): Promise<string> {
  const clerkId = `clerk_s7_${crypto.randomUUID()}`;
  const user = await usersService.provisionOrGetUser({
    clerkUserId: clerkId,
    email: `s7+${crypto.randomUUID()}@example.com`,
    displayName: null,
    signUpType: null,
  });
  return user.id;
}

async function makeWorkspace(userId: string): Promise<string> {
  const ws = await workspacesService.createWorkspace(userId, {
    name: `ws-${crypto.randomUUID()}`,
  });
  return ws.id;
}

beforeAll(async () => {
  if (reachable) await resetAndMigrate();
});
afterAll(async () => {
  await clientMod.closeDb();
});
beforeEach(() => {
  cloudinaryStub._state.existingIds.clear();
});

d('S7 upload-intent', () => {
  it('returns a signed envelope; publicId is scoped to caller', async () => {
    const userId = await makeUser();
    const wsId = await makeWorkspace(userId);
    const env = await sourceService.createUploadIntent(userId, wsId, {
      fileName: 'paper.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1000,
    });
    expect(env.publicId.startsWith(`rag-notebook/${userId}/${wsId}/`)).toBe(true);
    expect((env as unknown as { apiSecret?: unknown }).apiSecret).toBeUndefined();
  });

  it('rejects mime/extension mismatch', async () => {
    const userId = await makeUser();
    const wsId = await makeWorkspace(userId);
    await expect(
      sourceService.createUploadIntent(userId, wsId, {
        fileName: 'paper.pdf',
        mimeType: 'text/plain',
        sizeBytes: 100,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects file over the FREE-tier byte cap (PLAN_LIMIT_EXCEEDED)', async () => {
    const userId = await makeUser();
    const wsId = await makeWorkspace(userId);
    await expect(
      sourceService.createUploadIntent(userId, wsId, {
        fileName: 'paper.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100 * 1024 * 1024,
      }),
    ).rejects.toMatchObject({ code: 'PLAN_LIMIT_EXCEEDED' });
  });

  it('cross-tenant: returns NOT_FOUND for a workspace the caller does not own', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const wsId = await makeWorkspace(owner);
    await expect(
      sourceService.createUploadIntent(stranger, wsId, {
        fileName: 'paper.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

d('S7 create source — file backed', () => {
  it('rejects a phantom publicId (asset does not exist in Cloudinary)', async () => {
    const userId = await makeUser();
    const wsId = await makeWorkspace(userId);
    const publicId = uploadValidation.derivePublicId(userId, wsId);

    await expect(
      sourceService.createSource(userId, wsId, {
        type: 'PDF',
        publicId,
        fileName: 'paper.pdf',
        sizeBytes: 100,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('happy path: registers the source when the asset exists', async () => {
    const userId = await makeUser();
    const wsId = await makeWorkspace(userId);
    const publicId = uploadValidation.derivePublicId(userId, wsId);
    cloudinaryStub._state.existingIds.add(publicId);
    const src = await sourceService.createSource(userId, wsId, {
      type: 'PDF',
      publicId,
      fileName: 'paper.pdf',
      sizeBytes: 100,
    });
    expect(src.type).toBe('PDF');
    expect(src.status).toBe('UPLOADED');
    expect(src.displayStatus).toBe('uploading');
  });

  it('rejects a publicId not scoped to the caller (cross-tenant)', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const wsId = await makeWorkspace(owner);
    const publicIdForOwner = uploadValidation.derivePublicId(owner, wsId);
    cloudinaryStub._state.existingIds.add(publicIdForOwner);

    await expect(
      sourceService.createSource(stranger, wsId, {
        type: 'PDF',
        publicId: publicIdForOwner,
        fileName: 'paper.pdf',
        sizeBytes: 100,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

d('S7 create source — plan cap on the boundary', () => {
  it('rejects the 8th source on FREE (cap = 7)', async () => {
    const userId = await makeUser();
    const wsId = await makeWorkspace(userId);
    for (let i = 0; i < 7; i++) {
      const publicId = uploadValidation.derivePublicId(userId, wsId);
      cloudinaryStub._state.existingIds.add(publicId);
      await sourceService.createSource(userId, wsId, {
        type: 'PDF',
        publicId,
        fileName: `paper-${i}.pdf`,
        sizeBytes: 100,
      });
    }
    const publicId = uploadValidation.derivePublicId(userId, wsId);
    cloudinaryStub._state.existingIds.add(publicId);
    await expect(
      sourceService.createSource(userId, wsId, {
        type: 'PDF',
        publicId,
        fileName: 'over.pdf',
        sizeBytes: 100,
      }),
    ).rejects.toMatchObject({ code: 'PLAN_LIMIT_EXCEEDED' });
  });
});

d('S7 delete + download + status + list — cross tenant', () => {
  it('list, download, status, delete all return NOT_FOUND for stranger', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const wsId = await makeWorkspace(owner);
    const publicId = uploadValidation.derivePublicId(owner, wsId);
    cloudinaryStub._state.existingIds.add(publicId);
    const src = await sourceService.createSource(owner, wsId, {
      type: 'PDF',
      publicId,
      fileName: 'paper.pdf',
      sizeBytes: 100,
    });
    await expect(sourceService.listSources(stranger, wsId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(sourceService.getSource(stranger, src.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(sourceService.getSourceStatus(stranger, src.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(sourceService.createDownloadUrl(stranger, src.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(sourceService.deleteSource(stranger, src.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    const list = await sourceService.listSources(owner, wsId);
    expect(list.map((s) => s.id)).toContain(src.id);
    const dl = await sourceService.createDownloadUrl(owner, src.id);
    expect(dl.url).toContain(publicId);
    const del = await sourceService.deleteSource(owner, src.id);
    expect(del.deleted).toBe(true);
  });
});

d('S7 SSE stream — cleanup on disconnect', () => {
  it('drops the subscriber and clears the interval when the client disconnects', async () => {
    const owner = await makeUser();
    const wsId = await makeWorkspace(owner);

    const req = new EventEmitter() as EventEmitter & Record<string, unknown>;
    const res = new EventEmitter() as EventEmitter & Record<string, unknown>;
    const writes: string[] = [];
    let ended = false;
    res['writableEnded'] = false;
    res['setHeader'] = () => undefined;
    res['flushHeaders'] = () => undefined;
    res['write'] = (chunk: string) => {
      writes.push(chunk);
      return true;
    };
    res['end'] = () => {
      ended = true;
      res['writableEnded'] = true;
      return res;
    };

    const startCount = sourceEvents._subscriberCountForTest(owner, wsId);

    let cleanedUp = false;
    const unsub = sourceEvents.subscribeToSourceEvents(owner, wsId, (event) => {
      if (res['writableEnded'] as boolean) return;
      (res['write'] as (s: string) => boolean)(sourceEvents.encodeSourceStreamSSE(event));
    });
    const interval = setInterval(() => {
      (res['write'] as (s: string) => boolean)(
        sourceEvents.encodeSourceStreamSSE({ type: 'heartbeat', data: { t: Date.now() } }),
      );
    }, 20_000);
    interval.unref();

    const cleanup = (): void => {
      if (cleanedUp) return;
      cleanedUp = true;
      clearInterval(interval);
      unsub();
      (res['end'] as () => unknown)();
    };
    req.on('close', cleanup);
    res.on('close', cleanup);

    expect(sourceEvents._subscriberCountForTest(owner, wsId)).toBe(startCount + 1);

    sourceEvents.publishSourceEvent(owner, wsId, {
      type: 'heartbeat',
      data: { t: 1 },
    });
    expect(writes.some((w) => w.includes('heartbeat'))).toBe(true);

    req.emit('close');
    expect(cleanedUp).toBe(true);
    expect(ended).toBe(true);
    expect(sourceEvents._subscriberCountForTest(owner, wsId)).toBe(startCount);

    const before = writes.length;
    sourceEvents.publishSourceEvent(owner, wsId, { type: 'heartbeat', data: { t: 2 } });
    expect(writes.length).toBe(before);
  });
});
