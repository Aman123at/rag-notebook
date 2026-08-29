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
const entitlements = await import('../../src/services/entitlements/index.js');
const { AppError } = await import('../../src/errors/AppError.js');
const schema = await import('../../src/db/schema/index.js');
const { eq, sql } = await import('drizzle-orm');

async function makeUser(assignedTokens: bigint | null, plan: 'FREE' | 'PRO' = 'FREE') {
  const clerkId = `clerk_e_${crypto.randomUUID()}`;
  const user = await usersService.provisionOrGetUser({
    clerkUserId: clerkId,
    email: `e+${crypto.randomUUID()}@example.com`,
    displayName: null,
    signUpType: null,
  });
  const db = clientMod.getDb();
  await db
    .update(schema.users)
    .set({ assignedTokens, planTier: plan })
    .where(eq(schema.users.id, user.id));
  return user.id;
}

d('S5 entitlements — reserve / commit / release', () => {
  beforeAll(async () => {
    await resetAndMigrate();
  });
  afterAll(async () => {
    await clientMod.closeDb();
  });

  it('reserveTokens under budget succeeds and getBudget reflects it', async () => {
    const userId = await makeUser(1_000n);
    const { reservationId } = await entitlements.reserveTokens(userId, {
      kind: 'COMPLETION',
      estimatedTokens: 300,
      ttlSeconds: 60,
    });
    expect(reservationId).toMatch(/-/);
    const b = await entitlements.getBudget(userId);
    expect(b.assigned).toBe(1_000);
    expect(b.reserved).toBe(300);
    expect(b.remaining).toBe(700);
  });

  it('reserveTokens over budget throws TOKEN_QUOTA_EXCEEDED', async () => {
    const userId = await makeUser(500n);
    await expect(
      entitlements.reserveTokens(userId, {
        kind: 'COMPLETION',
        estimatedTokens: 501,
        ttlSeconds: 60,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('parallel reserveTokens for the same user cannot double-spend', async () => {
    const userId = await makeUser(1_000n);
    const settled = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        entitlements.reserveTokens(userId, {
          kind: 'COMPLETION',
          estimatedTokens: 300,
          ttlSeconds: 60,
        }),
      ),
    );
    const ok = settled.filter((s) => s.status === 'fulfilled').length;
    const err = settled.filter((s) => s.status === 'rejected');
    expect(ok).toBe(3);
    expect(err.length).toBe(2);
    err.forEach((e) => {
      const reason = e.reason as InstanceType<typeof AppError>;
      expect(reason.code).toBe('TOKEN_QUOTA_EXCEEDED');
    });

    const b = await entitlements.getBudget(userId);
    expect(b.reserved).toBe(900);
    expect(b.remaining).toBe(100);
  });

  it('PRO (unlimited) never throws quota errors and reports remaining: null', async () => {
    const userId = await makeUser(null, 'PRO');
    await entitlements.reserveTokens(userId, {
      kind: 'COMPLETION',
      estimatedTokens: 1_000_000,
      ttlSeconds: 60,
    });
    const b = await entitlements.getBudget(userId);
    expect(b.assigned).toBeNull();
    expect(b.remaining).toBeNull();
  });

  it('commitReservation moves reserved → used and upserts usage_daily', async () => {
    const userId = await makeUser(1_000n);
    const { reservationId } = await entitlements.reserveTokens(userId, {
      kind: 'COMPLETION',
      estimatedTokens: 200,
      ttlSeconds: 60,
    });
    const res = await entitlements.commitReservation(reservationId, 175);
    expect(res.status).toBe('committed');
    const user = await usersRepo.findUserById(userId);
    expect(Number(user!.usedTokensCompletion)).toBe(175);
    const b = await entitlements.getBudget(userId);
    expect(b.reserved).toBe(0);
    expect(b.remaining).toBe(1000 - 175);

    const again = await entitlements.commitReservation(reservationId, 175);
    expect(again.status).toBe('already_committed');
    const user2 = await usersRepo.findUserById(userId);
    expect(Number(user2!.usedTokensCompletion)).toBe(175);
  });

  it('releaseReservation frees the budget and is idempotent', async () => {
    const userId = await makeUser(1_000n);
    const { reservationId } = await entitlements.reserveTokens(userId, {
      kind: 'COMPLETION',
      estimatedTokens: 400,
      ttlSeconds: 60,
    });
    await entitlements.releaseReservation(reservationId);
    await entitlements.releaseReservation(reservationId);
    const b = await entitlements.getBudget(userId);
    expect(b.reserved).toBe(0);
  });

  it('sweepExpiredReservations expires past-due RESERVED rows', async () => {
    const userId = await makeUser(1_000n);
    const { reservationId } = await entitlements.reserveTokens(userId, {
      kind: 'COMPLETION',
      estimatedTokens: 100,
      ttlSeconds: 60,
    });

    const db = clientMod.getDb();
    await db
      .update(schema.tokenReservations)
      .set({ expiresAt: sql`now() - interval '1 minute'` })
      .where(eq(schema.tokenReservations.id, reservationId));
    const swept = await entitlements.sweepExpiredReservations();
    expect(swept).toBeGreaterThanOrEqual(1);
    const b = await entitlements.getBudget(userId);
    expect(b.reserved).toBe(0);
  });
});

d('S5 entitlements — coupon redemption', () => {
  async function makeCoupon(input: {
    tokenAmount: bigint;
    maxRedemptions?: number | null;
    isActive?: boolean;
    validTill?: Date | null;
  }): Promise<{ id: string; code: string }> {
    const db = clientMod.getDb();
    const code = `PROMO_${crypto.randomUUID().slice(0, 8)}`;
    const [row] = await db
      .insert(schema.coupons)
      .values({
        code,
        tokenAmount: input.tokenAmount,
        maxRedemptions: input.maxRedemptions ?? null,
        isActive: input.isActive ?? true,
        validTill: input.validTill ?? null,
      })
      .returning();
    return { id: row!.id, code };
  }

  it('redeemCoupon grants tokens and records the redemption', async () => {
    const userId = await makeUser(0n);
    const { code } = await makeCoupon({ tokenAmount: 5_000n });
    const res = await entitlements.redeemCoupon(userId, code);
    expect(res.tokensGranted).toBe(5000);
    const u = await usersRepo.findUserById(userId);
    expect(Number(u!.assignedTokens)).toBe(5000);

    await expect(entitlements.redeemCoupon(userId, code)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('inactive / expired / cap_reached all surface the right code', async () => {
    const userId = await makeUser(0n);
    const inactive = await makeCoupon({ tokenAmount: 1n, isActive: false });
    await expect(entitlements.redeemCoupon(userId, inactive.code)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    const expired = await makeCoupon({
      tokenAmount: 1n,
      validTill: new Date(Date.now() - 60_000),
    });
    await expect(entitlements.redeemCoupon(userId, expired.code)).rejects.toMatchObject({
      code: 'PLAN_LIMIT_EXCEEDED',
    });
    await expect(entitlements.redeemCoupon(userId, 'DOES_NOT_EXIST')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('parallel redemptions across users cannot exceed maxRedemptions', async () => {
    const CAP = 3;
    const { code } = await makeCoupon({ tokenAmount: 100n, maxRedemptions: CAP });
    const users = await Promise.all(Array.from({ length: 10 }, () => makeUser(0n)));
    const settled = await Promise.allSettled(users.map((u) => entitlements.redeemCoupon(u, code)));
    const ok = settled.filter((s) => s.status === 'fulfilled').length;
    expect(ok).toBe(CAP);

    const db = clientMod.getDb();
    const [reread] = await db.select().from(schema.coupons).where(eq(schema.coupons.code, code));
    expect(reread!.redemptionCount).toBe(CAP);

    settled
      .filter((s) => s.status === 'rejected')
      .forEach((s) => {
        const err = s.reason as InstanceType<typeof AppError>;
        expect(['PLAN_LIMIT_EXCEEDED', 'CONFLICT']).toContain(err.code);
      });
  });
});
