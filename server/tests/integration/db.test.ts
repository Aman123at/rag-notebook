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

const chunkIdMod = await import('../../src/db/chunk-id.js');
const clientMod = await import('../../src/db/client.js');
const usersRepo = await import('../../src/repository/users.repo.js');
const workspacesRepo = await import('../../src/repository/workspaces.repo.js');
const sourcesRepo = await import('../../src/repository/sources.repo.js');
const chunksRepo = await import('../../src/repository/chunks.repo.js');
const chatsRepo = await import('../../src/repository/chats.repo.js');
const messagesRepo = await import('../../src/repository/messages.repo.js');
const billingRepo = await import('../../src/repository/billing.repo.js');
const usageRepo = await import('../../src/repository/usage.repo.js');
const tokenResRepo = await import('../../src/repository/token-reservations.repo.js');
const artifactsRepo = await import('../../src/repository/artifacts.repo.js');
const attackRepo = await import('../../src/repository/attack-attempts.repo.js');

interface Ids {
  userA: string;
  userB: string;
  wsA1: string;
  wsA2: string;
  wsB1: string;
  sourceA1: string;
  chatA1: string;
}

const ids: Ids = {} as Ids;

d('database integration', () => {
  beforeAll(async () => {
    await resetAndMigrate();

    const a = await usersRepo.insertUser({
      clerkUserId: 'clerk_a',
      email: 'a@example.com',
      displayName: 'A',
    });
    const b = await usersRepo.insertUser({
      clerkUserId: 'clerk_b',
      email: 'b@example.com',
      displayName: 'B',
    });
    ids.userA = a.id;
    ids.userB = b.id;

    const wsA1 = await workspacesRepo.insertWorkspace({ userId: a.id, name: 'A1' });
    const wsA2 = await workspacesRepo.insertWorkspace({ userId: a.id, name: 'A2' });
    const wsB1 = await workspacesRepo.insertWorkspace({ userId: b.id, name: 'B1' });
    ids.wsA1 = wsA1.id;
    ids.wsA2 = wsA2.id;
    ids.wsB1 = wsB1.id;

    const src = await sourcesRepo.insertSourceAndBumpCounter({
      userId: a.id,
      workspaceId: wsA1.id,
      type: 'TEXT',
      title: 'hello.txt',
      originalRef: 'hello.txt',
    });
    ids.sourceA1 = src.id;

    const chat = await chatsRepo.insertChat({
      userId: a.id,
      workspaceId: wsA1.id,
      title: 'Chat A1',
    });
    ids.chatA1 = chat.id;
  }, 30_000);

  afterAll(async () => {
    await clientMod.closeDb();
  });

  it('users: findUserById round-trips', async () => {
    const u = await usersRepo.findUserById(ids.userA);
    expect(u?.email).toBe('a@example.com');
  });

  it('workspaces: soft-delete filters out from list', async () => {
    const before = await workspacesRepo.listWorkspacesForUser(ids.userA);
    expect(before.map((w) => w.id)).toContain(ids.wsA2);
    await workspacesRepo.softDeleteWorkspaceForUser(ids.userA, ids.wsA2);
    const after = await workspacesRepo.listWorkspacesForUser(ids.userA);
    expect(after.map((w) => w.id)).not.toContain(ids.wsA2);
  });

  it('workspaces: source_count counter reflects insertSourceAndBumpCounter', async () => {
    const ws = await workspacesRepo.findWorkspaceForUser(ids.userA, ids.wsA1);
    expect(ws?.sourceCount).toBe(1);
  });

  it('sources: cross-workspace read for the same user returns nothing (§3.1)', async () => {
    const wrong = await sourcesRepo.findSourceForUser(ids.userA, ids.sourceA1, ids.wsA2);
    expect(wrong).toBeNull();

    const right = await sourcesRepo.findSourceForUser(ids.userA, ids.sourceA1, ids.wsA1);
    expect(right?.id).toBe(ids.sourceA1);

    const foreign = await sourcesRepo.findSourceForUser(ids.userB, ids.sourceA1);
    expect(foreign).toBeNull();

    const bList = await sourcesRepo.listSourcesForWorkspace(ids.userB, ids.wsB1);
    expect(bList).toHaveLength(0);
  });

  it('sources: soft-delete cycles and adjusts the workspace counter', async () => {
    const throwaway = await sourcesRepo.insertSourceAndBumpCounter({
      userId: ids.userA,
      workspaceId: ids.wsA1,
      type: 'TEXT',
      title: 'delete-me.txt',
      originalRef: 'delete-me.txt',
    });
    const wsBefore = await workspacesRepo.findWorkspaceForUser(ids.userA, ids.wsA1);
    expect(wsBefore?.sourceCount).toBe(2);
    const deleted = await sourcesRepo.softDeleteSourceForUser(ids.userA, throwaway.id);
    expect(deleted?.id).toBe(throwaway.id);
    const wsAfter = await workspacesRepo.findWorkspaceForUser(ids.userA, ids.wsA1);
    expect(wsAfter?.sourceCount).toBe(1);
  });

  it('chunks: hydrate is tenant-scoped and skips foreign ids', async () => {
    const id0 = chunkIdMod.chunkId(ids.sourceA1, 0);
    await chunksRepo.insertChunksForSource(ids.sourceA1, [
      {
        sourceId: ids.sourceA1,
        workspaceId: ids.wsA1,
        userId: ids.userA,
        chunkIndex: 0,
        content: 'hello world',
        tokenCount: 2,
        locator: { kind: 'text_range', startChar: 0, endChar: 11 },
      },
    ]);

    const ours = await chunksRepo.findChunksByIdsForTenant(ids.userA, ids.wsA1, [id0]);
    expect(ours).toHaveLength(1);

    const wrongWs = await chunksRepo.findChunksByIdsForTenant(ids.userA, ids.wsA2, [id0]);
    expect(wrongWs).toHaveLength(0);

    const wrongUser = await chunksRepo.findChunksByIdsForTenant(ids.userB, ids.wsA1, [id0]);
    expect(wrongUser).toHaveLength(0);
  });

  it('chats + messages: tenant-scoped list, insert, soft delete', async () => {
    const m = await messagesRepo.insertMessage({
      chatId: ids.chatA1,
      userId: ids.userA,
      role: 'user',
      content: 'hi',
    });
    const list = await messagesRepo.listMessagesForChat(ids.userA, ids.chatA1);
    expect(list.map((r) => r.id)).toContain(m.id);

    const foreign = await messagesRepo.listMessagesForChat(ids.userB, ids.chatA1);
    expect(foreign).toHaveLength(0);

    const gone = await chatsRepo.softDeleteChatForUser(ids.userA, ids.chatA1);
    expect(gone?.id).toBe(ids.chatA1);
  });

  it('billing: coupon redemption is idempotent per user', async () => {
    const seeded = await billingRepo.redeemCouponForUser(ids.userA, 'MISSING');
    expect(seeded).toBeNull();

    const db = clientMod.getDb();
    const { coupons } = await import('../../src/db/schema/index.js');
    await db.insert(coupons).values({ code: 'TEST-1000', tokenAmount: 1000n });
    const r1 = await billingRepo.redeemCouponForUser(ids.userA, 'TEST-1000');
    expect(r1?.tokensGranted).toBe(1000n);

    const r2 = await billingRepo.redeemCouponForUser(ids.userA, 'TEST-1000');
    expect(r2).toBeNull();
  });

  it('billing: webhook_events is idempotent (replay-safe)', async () => {
    const first = await billingRepo.recordWebhookEvent('razorpay', 'evt_1', { any: 'thing' });
    expect(first).toBe(true);
    const second = await billingRepo.recordWebhookEvent('razorpay', 'evt_1', { any: 'thing' });
    expect(second).toBe(false);
  });

  it('usage_daily: upsert accumulates per-day totals', async () => {
    await usageRepo.bumpUsageDaily(ids.userA, '2026-01-01', { embedding: 10n, requests: 1 });
    await usageRepo.bumpUsageDaily(ids.userA, '2026-01-01', { completion: 5n, requests: 1 });
    const days = await usageRepo.listUsageForUser(ids.userA, '2025-12-31');
    const jan1 = days.find((d) => d.date === '2026-01-01');
    expect(jan1?.embeddingTokens).toBe(10n);
    expect(jan1?.completionTokens).toBe(5n);
    expect(jan1?.requestCount).toBe(2);
  });

  it('token_reservations: reserve + commit sum survives commit', async () => {
    const r = await tokenResRepo.insertReservation({
      userId: ids.userA,
      kind: 'COMPLETION',
      estimatedTokens: 500n,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const active = await tokenResRepo.sumActiveReservationsForUser(ids.userA);
    expect(active).toBe(500n);
    await tokenResRepo.markReservation(r.id, 'COMMITTED');
    const afterCommit = await tokenResRepo.sumActiveReservationsForUser(ids.userA);
    expect(afterCommit).toBe(0n);
  });

  it('artifacts + attack_attempts: insert + tenant-scoped read', async () => {
    const art = await artifactsRepo.insertArtifact({
      sourceId: ids.sourceA1,
      userId: ids.userA,
      type: 'SUMMARY',
      status: 'READY',
      content: { text: 'summary' },
    });
    const listA = await artifactsRepo.listArtifactsForSource(ids.userA, ids.sourceA1);
    expect(listA.map((r) => r.id)).toContain(art.id);
    const listB = await artifactsRepo.listArtifactsForSource(ids.userB, ids.sourceA1);
    expect(listB).toHaveLength(0);

    const attempt = await attackRepo.recordAttackAttempt({
      userId: ids.userA,
      attackType: 'PROMPT_INJECTION',
      stage: 'QUERY',
      attemptNumber: 1,
      detector: 'REGEX',
      matchedRules: ['ignore_previous_instructions'],
      excerpt: 'ignore all prior…',
    });
    expect(attempt.id).toBeTypeOf('string');
    const count = await attackRepo.countRecentAttemptsForUser(ids.userA, new Date(0));
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
