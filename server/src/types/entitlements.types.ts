import type { PlanTier } from '@/contract/index.js';
import type { CouponRedemptionRow, CouponRow } from '@/db/schema/index.js';

export interface TokenBudget {
  assigned: number | null;
  usedEmbedding: number;
  usedCompletion: number;
  reserved: number;

  remaining: number | null;
}

export interface PlanLimitExceededDetails {
  limit: number;
  current: number;
  plan: PlanTier;
  upgradeUrl: string;
}

export interface RedeemResult {
  tokensGranted: number;
  couponCode: string;
}

export type RedeemOutcome =
  | { kind: 'ok'; redemption: CouponRedemptionRow; coupon: CouponRow; tokensGranted: bigint }
  | { kind: 'not_found' }
  | { kind: 'inactive' }
  | { kind: 'expired' }
  | { kind: 'cap_reached' }
  | { kind: 'already_redeemed' };
