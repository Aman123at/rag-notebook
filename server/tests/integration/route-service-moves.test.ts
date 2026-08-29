import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
const usageService = await import('../../src/services/usage.service.js');
const messagesRepo = await import('../../src/repository/messages.repo.js');
const usageRepo = await import('../../src/repository/usage.repo.js');
const { AppError } = await import('../../src/errors/AppError.js');

async function makeUser(): Promise<string> {
  const user = await usersService.provisionOrGetUser({
    clerkUserId: `clerk_r03_${crypto.randomUUID()}`,
    email: `r03+${crypto.randomUUID()}@example.com`,
    displayName: null,
    signUpType: null,
  });
  return user.id;
}

async function makeAssistantMessage(userId: string): Promise<{ chatId: string; id: string }> {
  const ws = await workspacesService.createWorkspace(userId, { name: 'r03' });
  const chat = await chatsService.createChat(userId, ws.id, { title: 'r03' });
  const row = await messagesRepo.insertMessage({
    chatId: chat.id,
    userId,
    role: 'assistant',
    content: 'hello',
  });
  return { chatId: chat.id, id: row.id };
}

beforeAll(async () => {
  if (reachable) await resetAndMigrate();
});
afterAll(async () => {
  await clientMod.closeDb();
});

d('setMessageReaction (moved from messages.route.ts)', () => {
  it('stores a like and returns the hydrated wire message', async () => {
    const userId = await makeUser();
    const msg = await makeAssistantMessage(userId);

    const wire = await chatsService.setMessageReaction(userId, msg.id, { reaction: 'like' });

    expect(wire.id).toBe(msg.id);
    expect(wire.reaction).toBe('like');
    expect(wire.dislikedReason).toBeNull();
    expect(wire.citations).toEqual([]);
    expect(wire.webCitations).toEqual([]);
  });

  it('stores a dislike with its reason and note', async () => {
    const userId = await makeUser();
    const msg = await makeAssistantMessage(userId);

    const wire = await chatsService.setMessageReaction(userId, msg.id, {
      reaction: 'dislike',
      dislikedReason: 'HALLUCINATED',
      dislikedNote: 'made it up',
    });

    expect(wire.reaction).toBe('dislike');
    expect(wire.dislikedReason).toBe('HALLUCINATED');
  });

  it('drops a reason carried alongside a like — dislike fields are dislike-only', async () => {
    const userId = await makeUser();
    const msg = await makeAssistantMessage(userId);

    await chatsService.setMessageReaction(userId, msg.id, {
      reaction: 'dislike',
      dislikedReason: 'OFF_TOPIC',
      dislikedNote: 'nope',
    });
    const wire = await chatsService.setMessageReaction(userId, msg.id, { reaction: 'like' });

    expect(wire.reaction).toBe('like');
    expect(wire.dislikedReason).toBeNull();
  });

  it('clears the reason and note when the reaction is cleared', async () => {
    const userId = await makeUser();
    const msg = await makeAssistantMessage(userId);

    await chatsService.setMessageReaction(userId, msg.id, {
      reaction: 'dislike',
      dislikedReason: 'INCOMPLETE',
    });
    const wire = await chatsService.setMessageReaction(userId, msg.id, { reaction: null });

    expect(wire.reaction).toBeNull();
    expect(wire.dislikedReason).toBeNull();
  });

  it('refuses a user message — reactions are assistant-only', async () => {
    const userId = await makeUser();
    const ws = await workspacesService.createWorkspace(userId, { name: 'r03' });
    const chat = await chatsService.createChat(userId, ws.id, { title: 'r03' });
    const row = await messagesRepo.insertMessage({
      chatId: chat.id,
      userId,
      role: 'user',
      content: 'hi',
    });

    await expect(
      chatsService.setMessageReaction(userId, row.id, { reaction: 'like' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it("is NOT_FOUND, never FORBIDDEN, for another user's message", async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const msg = await makeAssistantMessage(owner);

    await expect(
      chatsService.setMessageReaction(stranger, msg.id, { reaction: 'like' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const wire = await chatsService.setMessageReaction(owner, msg.id, { reaction: null });
    expect(wire.reaction).toBeNull();
  });

  it('is NOT_FOUND for an unknown message id', async () => {
    const userId = await makeUser();
    await expect(
      chatsService.setMessageReaction(userId, crypto.randomUUID(), { reaction: 'like' }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

d('getMe / updateMe (moved from identity.route.ts)', () => {
  it('returns the wire payload for a live user', async () => {
    const userId = await makeUser();
    const me = await usersService.getMe(userId);
    expect(me.id).toBe(userId);
    expect(me.planTier).toBe('FREE');
  });

  it('fails closed with UNAUTHENTICATED when the row vanished after the auth check', async () => {
    await expect(usersService.getMe(crypto.randomUUID())).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('updates the display name and returns the fresh payload', async () => {
    const userId = await makeUser();
    const me = await usersService.updateMe(userId, { displayName: 'Renamed' });
    expect(me.displayName).toBe('Renamed');
    expect((await usersService.getMe(userId)).displayName).toBe('Renamed');
  });

  it('fails closed with UNAUTHENTICATED on update when the row vanished', async () => {
    await expect(
      usersService.updateMe(crypto.randomUUID(), { displayName: 'x' }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});

d('getUsageSummary (moved from observability.route.ts)', () => {
  function today(offsetDays = 0): string {
    const d2 = new Date();
    d2.setUTCDate(d2.getUTCDate() - offsetDays);
    return d2.toISOString().slice(0, 10);
  }

  it('rolls per-day rows up into totals', async () => {
    const userId = await makeUser();
    await usageRepo.bumpUsageDaily(userId, today(0), {
      embedding: 10n,
      completion: 100n,
      requests: 1,
    });
    await usageRepo.bumpUsageDaily(userId, today(1), {
      embedding: 5n,
      completion: 50n,
      requests: 2,
    });

    const out = await usageService.getUsageSummary(userId, 30);

    expect(out.days.length).toBe(2);
    expect(out.totals).toEqual({
      promptTokens: 0,
      completionTokens: 150,
      embeddingTokens: 15,
      messageCount: 3,
    });

    expect(out.days.every((day) => day.promptTokens === 0)).toBe(true);
  });

  it('excludes days outside the requested window', async () => {
    const userId = await makeUser();
    await usageRepo.bumpUsageDaily(userId, today(0), {
      embedding: 1n,
      completion: 1n,
      requests: 1,
    });
    await usageRepo.bumpUsageDaily(userId, today(10), {
      embedding: 9n,
      completion: 9n,
      requests: 9,
    });

    const out = await usageService.getUsageSummary(userId, 2);

    expect(out.days.length).toBe(1);
    expect(out.totals.messageCount).toBe(1);
  });

  it("never returns another user's usage", async () => {
    const mine = await makeUser();
    const theirs = await makeUser();
    await usageRepo.bumpUsageDaily(theirs, today(0), {
      embedding: 7n,
      completion: 7n,
      requests: 7,
    });

    const out = await usageService.getUsageSummary(mine, 30);
    expect(out.days).toEqual([]);
    expect(out.totals.messageCount).toBe(0);
  });

  it('returns an empty window rather than throwing when there is no usage', async () => {
    const userId = await makeUser();
    const out = await usageService.getUsageSummary(userId, 30);
    expect(out.days).toEqual([]);
    expect(out.totals).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      embeddingTokens: 0,
      messageCount: 0,
    });
  });
});

d('handleClerkWebhookEvent (moved from webhooks.route.ts)', () => {
  function envelope(type: string, data: Record<string, unknown>) {
    return {
      svixId: `svix_${crypto.randomUUID()}`,
      envelope: { type, data },
      requestId: 'req-r03',
    };
  }

  it('provisions a user on user.created and reports it processed', async () => {
    const clerkId = `clerk_r03_hook_${crypto.randomUUID()}`;
    const ev = envelope('user.created', {
      id: clerkId,
      primary_email_address_id: 'e1',
      email_addresses: [{ id: 'e1', email_address: `hook+${clerkId}@example.com` }],
      first_name: 'Ada',
      last_name: 'Lovelace',
      username: null,
      external_accounts: [],
    });

    expect(await usersService.handleClerkWebhookEvent(ev)).toEqual({ outcome: 'processed' });
  });

  it('ignores a redelivery of the same svix id without re-running the side effect', async () => {
    const clerkId = `clerk_r03_hook_${crypto.randomUUID()}`;
    const ev = envelope('user.updated', {
      id: clerkId,
      primary_email_address_id: 'e1',
      email_addresses: [{ id: 'e1', email_address: `hook+${clerkId}@example.com` }],
      first_name: 'First',
      last_name: null,
      username: null,
      external_accounts: [],
    });

    expect(await usersService.handleClerkWebhookEvent(ev)).toEqual({ outcome: 'processed' });
    expect(await usersService.handleClerkWebhookEvent(ev)).toEqual({ outcome: 'replay' });
  });

  it('records an unhandled event type for the audit trail but runs no side effect', async () => {
    const out = await usersService.handleClerkWebhookEvent(
      envelope('session.created', { id: 'x' }),
    );
    expect(out).toEqual({ outcome: 'ignored' });
  });

  it('rejects a user payload with no id', async () => {
    await expect(
      usersService.handleClerkWebhookEvent(envelope('user.created', { first_name: 'nobody' })),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
