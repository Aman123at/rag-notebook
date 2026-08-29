import { AppError } from '@/errors/AppError.js';
import { redeemCouponAtomic } from '@/repository/coupon.repo.js';
import type { RedeemResult } from '@/types/entitlements.types.js';

export async function redeemCoupon(userId: string, code: string): Promise<RedeemResult> {
  const normalised = code.trim();
  if (normalised.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Coupon code is required.');
  }
  const outcome = await redeemCouponAtomic(userId, normalised);
  switch (outcome.kind) {
    case 'ok':
      return {
        tokensGranted: Number(outcome.tokensGranted),
        couponCode: outcome.coupon.code,
      };
    case 'not_found':
      throw new AppError('NOT_FOUND', 'Coupon not found.', { exposeDetails: false });
    case 'inactive':
      throw new AppError('FORBIDDEN', 'Coupon is no longer active.', { exposeDetails: false });
    case 'expired':
      throw new AppError('PLAN_LIMIT_EXCEEDED', 'Coupon has expired.', {
        details: { reason: 'expired' as const },
      });
    case 'cap_reached':
      throw new AppError('PLAN_LIMIT_EXCEEDED', 'Coupon redemption limit reached.', {
        details: { reason: 'cap_reached' as const },
      });
    case 'already_redeemed':
      throw new AppError('CONFLICT', 'You have already redeemed this coupon.', {
        exposeDetails: false,
      });
  }
}
