import { eq, sql } from 'drizzle-orm';

import { withTransaction } from '@/db/client.js';
import { couponRedemptions, coupons } from '@/db/schema/index.js';
import type { RedeemOutcome } from '@/types/entitlements.types.js';

import { findCouponByCode } from './billing.repo.js';
import { incrementAssignedTokens } from './users.repo.js';

export async function redeemCouponAtomic(userId: string, code: string): Promise<RedeemOutcome> {
  return withTransaction(async (tx) => {
    const coupon = await findCouponByCode(code, tx);
    if (!coupon) return { kind: 'not_found' as const };
    if (!coupon.isActive) return { kind: 'inactive' as const };
    if (coupon.validTill && coupon.validTill.getTime() < Date.now()) {
      return { kind: 'expired' as const };
    }
    if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) {
      return { kind: 'cap_reached' as const };
    }

    const insertResult = await tx
      .insert(couponRedemptions)
      .values({ couponId: coupon.id, userId, tokensGranted: coupon.tokenAmount })
      .onConflictDoNothing({ target: [couponRedemptions.couponId, couponRedemptions.userId] })
      .returning();
    const inserted = insertResult[0];
    if (!inserted) return { kind: 'already_redeemed' as const };

    const [bumped] = await tx
      .update(coupons)
      .set({ redemptionCount: sql`${coupons.redemptionCount} + 1`, updatedAt: sql`now()` })
      .where(eq(coupons.id, coupon.id))
      .returning();
    if (!bumped) {
      throw new Error('redeemCouponAtomic: coupon vanished mid-transaction');
    }
    if (bumped.maxRedemptions !== null && bumped.redemptionCount > bumped.maxRedemptions) {
      throw new CapExceededDuringInsert();
    }

    await incrementAssignedTokens(userId, coupon.tokenAmount, tx);
    return {
      kind: 'ok' as const,
      redemption: inserted,
      coupon: bumped,
      tokensGranted: coupon.tokenAmount,
    };
  }).catch((err: unknown) => {
    if (err instanceof CapExceededDuringInsert) return { kind: 'cap_reached' as const };
    throw err;
  });
}

class CapExceededDuringInsert extends Error {
  public override readonly name = 'CapExceededDuringInsert';
  constructor() {
    super('coupon cap exceeded during concurrent redemption');
  }
}
