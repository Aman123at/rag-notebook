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

const usersRepo = await import('../../src/repository/users.repo.js');
const usersService = await import('../../src/services/users.service.js');
const clientMod = await import('../../src/db/client.js');

d('S4 users service', () => {
  beforeAll(async () => {
    await resetAndMigrate();
  });

  afterAll(async () => {
    await clientMod.closeDb();
  });

  it('parallel provisionOrGetUser for the same clerk id lands exactly one row', async () => {
    const clerkId = `clerk_race_${crypto.randomUUID()}`;
    const email = `race+${crypto.randomUUID()}@example.com`;

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        usersService.provisionOrGetUser({
          clerkUserId: clerkId,
          email,
          displayName: 'Race Runner',
          signUpType: 'oauth_google',
        }),
      ),
    );
    const ids = new Set(results.map((r) => r.id));
    expect(ids.size).toBe(1);

    const row = await usersRepo.findUserByClerkId(clerkId);
    expect(row).not.toBeNull();
    expect(row?.email).toBe(email);
    expect(row?.planTier).toBe('FREE');
    expect(row?.assignedTokens).not.toBeNull();
  });

  it('a blocked user surfaces isBlocked=true and buildMePayload throws USER_BLOCKED', async () => {
    const user = await usersService.provisionOrGetUser({
      clerkUserId: `clerk_blocked_${crypto.randomUUID()}`,
      email: `blocked+${crypto.randomUUID()}@example.com`,
      displayName: null,
      signUpType: null,
    });

    const db = clientMod.getDb();
    const { users } = await import('../../src/db/schema/index.js');
    const { eq, sql } = await import('drizzle-orm');
    await db
      .update(users)
      .set({ isBlocked: true, blockedAt: sql`now()`, blockedReason: 'test' })
      .where(eq(users.id, user.id));
    const reread = await usersRepo.findUserById(user.id);
    expect(reread?.isBlocked).toBe(true);
    await expect(usersService.buildMePayload(reread!)).rejects.toThrow(/blocked/i);
  });

  it('user.deleted anonymises the row and keeps FKs intact', async () => {
    const clerkId = `clerk_del_${crypto.randomUUID()}`;
    const user = await usersService.provisionOrGetUser({
      clerkUserId: clerkId,
      email: `del+${crypto.randomUUID()}@example.com`,
      displayName: 'Del',
      signUpType: null,
    });
    await usersService.onClerkUserDeleted(clerkId);

    const byClerk = await usersRepo.findUserByClerkId(clerkId);
    expect(byClerk).toBeNull();
    const byId = await usersRepo.findUserById(user.id);
    expect(byId).not.toBeNull();
    expect(byId?.isBlocked).toBe(true);
    expect(byId?.isActive).toBe(false);
    expect(byId?.email).toMatch(/@anon\.local$/);
    expect(byId?.clerkUserId.startsWith('deleted:')).toBe(true);
  });
});
