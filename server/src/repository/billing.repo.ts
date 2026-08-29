import { and, eq, sql } from 'drizzle-orm';

import { exec, type Executor, withTransaction } from '@/db/client.js';
import {
  type CouponRedemptionRow,
  couponRedemptions,
  type CouponRow,
  coupons,
  webhookEvents,
} from '@/db/schema/index.js';

export async function findCouponByCode(code: string, tx?: Executor): Promise<CouponRow | null> {
  const rows = await exec(tx).select().from(coupons).where(eq(coupons.code, code)).limit(1);
  return rows[0] ?? null;
}

export async function redeemCouponForUser(
  userId: string,
  code: string,
): Promise<CouponRedemptionRow | null> {
  return withTransaction(async (tx) => {
    const coupon = await findCouponByCode(code, tx);
    if (!coupon || !coupon.isActive) return null;
    if (coupon.validTill && coupon.validTill.getTime() < Date.now()) return null;
    if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) {
      return null;
    }
    const insertResult = await tx
      .insert(couponRedemptions)
      .values({ couponId: coupon.id, userId, tokensGranted: coupon.tokenAmount })
      .onConflictDoNothing({ target: [couponRedemptions.couponId, couponRedemptions.userId] })
      .returning();
    const inserted = insertResult[0];
    if (!inserted) return null;
    await tx
      .update(coupons)
      .set({
        redemptionCount: sql`${coupons.redemptionCount} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(coupons.id, coupon.id));
    return inserted;
  });
}

export async function recordWebhookEvent(
  provider: string,
  eventId: string,
  payload: unknown,
  tx?: Executor,
): Promise<boolean> {
  const result = await exec(tx)
    .insert(webhookEvents)
    .values({ provider, eventId, payload })
    .onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.eventId] })
    .returning({ id: webhookEvents.id });
  return result.length > 0;
}

export async function markWebhookProcessed(
  provider: string,
  eventId: string,
  tx?: Executor,
): Promise<void> {
  await exec(tx)
    .update(webhookEvents)
    .set({ processedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(webhookEvents.provider, provider), eq(webhookEvents.eventId, eventId)));
}
