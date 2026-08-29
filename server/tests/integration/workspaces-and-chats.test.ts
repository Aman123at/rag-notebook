import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { isDbReachable, resetAndMigrate, TEST_DATABASE_URL } from './setup.js';

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';
process.env['LOG_LEVEL'] = 'silent';
process.env['APP_URL'] = 'http://localhost:3000';
process.env['CLIENT_ORIGINS'] = 'http://localhost:5173';
process.env['DATABASE_URL'] = TEST_DATABASE_URL;

const reachable = await isDbReachable();
const d = reachable ? describe : describe.skip;

const clientMod = await import('../../src/db/client.js');
const usersService = await import('../../src/services/users.service.js');
const workspacesService = await import('../../src/services/workspaces.service.js');
const chatsService = await import('../../src/services/chats.service.js');
const workspacesRepo = await import('../../src/repository/workspaces.repo.js');
const chatsRepo = await import('../../src/repository/chats.repo.js');
const sourcesRepo = await import('../../src/repository/sources.repo.js');
const { AppError } = await import('../../src/errors/AppError.js');
const contract = await import('../../src/contract/index.js');
const entitlements = await import('../../src/services/entitlements/index.js');

async function makeUser(): Promise<string> {
  const clerkId = `clerk_s6_${crypto.randomUUID()}`;
  const user = await usersService.provisionOrGetUser({
    clerkUserId: clerkId,
    email: `s6+${crypto.randomUUID()}@example.com`,
    displayName: null,
    signUpType: null,
  });
  return user.id;
}

beforeAll(async () => {
  if (reachable) await resetAndMigrate();
});
afterAll(async () => {
  await clientMod.closeDb();
});
beforeEach(() => {
  vi.restoreAllMocks();
});

describe('S6 contract validation (route boundary)', () => {
  it('CreateWorkspaceBody rejects empty name', () => {
    const r = contract.CreateWorkspaceBodySchema.safeParse({ name: '' });
    expect(r.success).toBe(false);
  });
  it('CreateWorkspaceBody rejects >120-char name', () => {
    const r = contract.CreateWorkspaceBodySchema.safeParse({ name: 'x'.repeat(121) });
    expect(r.success).toBe(false);
  });
  it('CreateWorkspaceBody accepts a good body', () => {
    const r = contract.CreateWorkspaceBodySchema.safeParse({ name: 'ok', description: 'd' });
    expect(r.success).toBe(true);
  });
  it('UpdateWorkspaceBody accepts explicit-null description', () => {
    const r = contract.UpdateWorkspaceBodySchema.safeParse({ description: null });
    expect(r.success).toBe(true);
  });
  it('WorkspaceParams rejects non-uuid', () => {
    const r = contract.WorkspaceParamsSchema.safeParse({ workspaceId: 'not-a-uuid' });
    expect(r.success).toBe(false);
  });
  it('CreateChatBody accepts empty body (title becomes default)', () => {
    const r = contract.CreateChatBodySchema.safeParse({});
    expect(r.success).toBe(true);
  });
  it('CreateChatBody rejects title over 200 chars', () => {
    const r = contract.CreateChatBodySchema.safeParse({ title: 'x'.repeat(201) });
    expect(r.success).toBe(false);
  });
  it('UpdateChatBody accepts partial flag toggles', () => {
    const r = contract.UpdateChatBodySchema.safeParse({ isArchived: true });
    expect(r.success).toBe(true);
  });
});

d('S6 workspaces service (happy path + tenancy)', () => {
  it('list is empty for a new user; create adds one; get reads it back', async () => {
    const u = await makeUser();
    const empty = await workspacesService.listWorkspaces(u, { limit: 10, offset: 0 });
    expect(empty.items).toHaveLength(0);
    expect(empty.total).toBe(0);
    const created = await workspacesService.createWorkspace(u, { name: 'Playground' });
    expect(created.name).toBe('Playground');
    const listed = await workspacesService.listWorkspaces(u, { limit: 10, offset: 0 });
    expect(listed.items).toHaveLength(1);
    expect(listed.total).toBe(1);
    const read = await workspacesService.getWorkspace(u, created.id);
    expect(read.id).toBe(created.id);
  });

  it('cross-tenant get returns NOT_FOUND (no existence leak)', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const ws = await workspacesService.createWorkspace(owner, { name: 'Private' });
    await expect(workspacesService.getWorkspace(stranger, ws.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('create with a duplicate name (case-insensitive) → CONFLICT, not 500', async () => {
    const u = await makeUser();
    await workspacesService.createWorkspace(u, { name: 'Team Alpha' });
    await expect(
      workspacesService.createWorkspace(u, { name: 'team alpha' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('two users can each own a workspace with the same name', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await workspacesService.createWorkspace(a, { name: 'Shared' });
    await expect(workspacesService.createWorkspace(b, { name: 'Shared' })).resolves.toBeDefined();
  });

  it('create hits PLAN_LIMIT_EXCEEDED at FREE cap', async () => {
    const u = await makeUser();
    const spy = vi.spyOn(entitlements, 'assertCanCreateWorkspace').mockRejectedValueOnce(
      new AppError('PLAN_LIMIT_EXCEEDED', 'Workspace limit reached.', {
        details: { limit: 10, current: 10, plan: 'FREE', upgradeUrl: '/upgrade' },
      }),
    );
    await expect(workspacesService.createWorkspace(u, { name: 'x' })).rejects.toMatchObject({
      code: 'PLAN_LIMIT_EXCEEDED',
    });
    expect(spy).toHaveBeenCalled();
  });

  it('update renames; a name collision → CONFLICT', async () => {
    const u = await makeUser();
    const a = await workspacesService.createWorkspace(u, { name: 'One' });
    await workspacesService.createWorkspace(u, { name: 'Two' });
    const patched = await workspacesService.updateWorkspace(u, a.id, { name: 'Three' });
    expect(patched.name).toBe('Three');
    await expect(workspacesService.updateWorkspace(u, a.id, { name: 'Two' })).rejects.toMatchObject(
      { code: 'CONFLICT' },
    );
  });

  it('cross-tenant update → NOT_FOUND', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const ws = await workspacesService.createWorkspace(owner, { name: 'X' });
    await expect(
      workspacesService.updateWorkspace(stranger, ws.id, { name: 'Y' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('delete soft-deletes the workspace and cascades to its chats + sources', async () => {
    const u = await makeUser();
    const ws = await workspacesService.createWorkspace(u, { name: 'Cascade' });
    const chat = await chatsService.createChat(u, ws.id, { title: 'c' });

    const src = await sourcesRepo.insertSourceAndBumpCounter({
      workspaceId: ws.id,
      userId: u,
      type: 'TEXT',
      status: 'PENDING',
      title: 'seed',
      originalRef: 'seed',
    });
    const res = await workspacesService.deleteWorkspace(u, ws.id);
    expect(res).toEqual({ id: ws.id, deleted: true });

    const stillListed = await workspacesService.listWorkspaces(u, { limit: 10, offset: 0 });
    expect(stillListed.items.find((w) => w.id === ws.id)).toBeUndefined();
    const chatReread = await chatsRepo.findChatForUser(u, chat.id);
    expect(chatReread).toBeNull();
    const srcReread = await sourcesRepo.findSourceForUser(u, src.id);
    expect(srcReread).toBeNull();

    const wsRow = await workspacesRepo.findWorkspaceForUser(u, ws.id);
    expect(wsRow).toBeNull();
  });

  it('cross-tenant delete → NOT_FOUND', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const ws = await workspacesService.createWorkspace(owner, { name: 'Guard' });
    await expect(workspacesService.deleteWorkspace(stranger, ws.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('list pagination meta.total comes from a real windowed count', async () => {
    const u = await makeUser();
    for (let i = 0; i < 5; i += 1) {
      await workspacesService.createWorkspace(u, { name: `ws-${i}` });
    }
    const page1 = await workspacesService.listWorkspaces(u, { limit: 2, offset: 0 });
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(5);
    const page3 = await workspacesService.listWorkspaces(u, { limit: 2, offset: 4 });
    expect(page3.items).toHaveLength(1);
    expect(page3.total).toBe(5);
  });
});

d('S6 chats service (happy path + tenancy)', () => {
  it('create → list → get → update → delete round-trip', async () => {
    const u = await makeUser();
    const ws = await workspacesService.createWorkspace(u, { name: 'ChatHome' });
    const chat = await chatsService.createChat(u, ws.id, { title: 'first' });
    expect(chat.workspaceId).toBe(ws.id);
    const listed = await chatsService.listChats(u, ws.id, { limit: 10, offset: 0 });
    expect(listed.items).toHaveLength(1);
    expect(listed.total).toBe(1);
    const read = await chatsService.getChat(u, chat.id);
    expect(read.title).toBe('first');
    const renamed = await chatsService.updateChat(u, chat.id, { title: 'renamed' });
    expect(renamed.title).toBe('renamed');
    const deleted = await chatsService.deleteChat(u, chat.id);
    expect(deleted).toEqual({ id: chat.id, deleted: true });
    await expect(chatsService.getChat(u, chat.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('create without title falls back to "New chat"', async () => {
    const u = await makeUser();
    const ws = await workspacesService.createWorkspace(u, { name: 'Untitled' });
    const chat = await chatsService.createChat(u, ws.id, {});
    expect(chat.title).toBe('New chat');
  });

  it('list in another user’s workspace returns NOT_FOUND (no leak via [])', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const ws = await workspacesService.createWorkspace(owner, { name: 'Hidden' });
    await chatsService.createChat(owner, ws.id, { title: 'a' });
    await expect(
      chatsService.listChats(stranger, ws.id, { limit: 10, offset: 0 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('cross-tenant get/update/delete on a chat all return NOT_FOUND', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const ws = await workspacesService.createWorkspace(owner, { name: 'B' });
    const chat = await chatsService.createChat(owner, ws.id, { title: 'x' });
    await expect(chatsService.getChat(stranger, chat.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(chatsService.updateChat(stranger, chat.id, { title: 'y' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(chatsService.deleteChat(stranger, chat.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('create in another user’s workspace returns NOT_FOUND (plan-limit path guards it too)', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const ws = await workspacesService.createWorkspace(owner, { name: 'C' });
    await expect(chatsService.createChat(stranger, ws.id, { title: 'z' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('listMessages on an empty chat returns []', async () => {
    const u = await makeUser();
    const ws = await workspacesService.createWorkspace(u, { name: 'M' });
    const chat = await chatsService.createChat(u, ws.id, { title: 'm' });
    const msgs = await chatsService.listMessages(u, chat.id);
    expect(msgs).toEqual([]);
  });

  it('listMessages on another user’s chat returns NOT_FOUND', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const ws = await workspacesService.createWorkspace(owner, { name: 'MM' });
    const chat = await chatsService.createChat(owner, ws.id, { title: 'mm' });
    await expect(chatsService.listMessages(stranger, chat.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('createChat is idempotent per workspace — second call returns the first chat', async () => {
    const u = await makeUser();
    const ws = await workspacesService.createWorkspace(u, { name: 'One' });
    const first = await chatsService.createChat(u, ws.id, { title: 'kept' });
    const second = await chatsService.createChat(u, ws.id, { title: 'ignored' });
    expect(second.id).toBe(first.id);

    expect(second.title).toBe('kept');
    const listed = await chatsService.listChats(u, ws.id, { limit: 10, offset: 0 });
    expect(listed.items).toHaveLength(1);
  });

  it('concurrent creates never produce two live chats (unique index guards the race)', async () => {
    const u = await makeUser();
    const ws = await workspacesService.createWorkspace(u, { name: 'Race' });
    const results = await Promise.all([
      chatsService.createChat(u, ws.id, { title: 'a' }),
      chatsService.createChat(u, ws.id, { title: 'b' }),
      chatsService.createChat(u, ws.id, { title: 'c' }),
    ]);
    const uniqueIds = new Set(results.map((c) => c.id));
    expect(uniqueIds.size).toBe(1);
    const listed = await chatsService.listChats(u, ws.id, { limit: 10, offset: 0 });
    expect(listed.items).toHaveLength(1);
  });

  it('deleting a chat frees the workspace to create another', async () => {
    const u = await makeUser();
    const ws = await workspacesService.createWorkspace(u, { name: 'Recycle' });
    const first = await chatsService.createChat(u, ws.id, { title: 'gone' });
    await chatsService.deleteChat(u, first.id);
    const second = await chatsService.createChat(u, ws.id, { title: 'fresh' });
    expect(second.id).not.toBe(first.id);
    expect(second.title).toBe('fresh');
  });
});
