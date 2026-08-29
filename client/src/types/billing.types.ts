/**
 * Billing / coupon / plan type aliases.
 */
import type { GetResult, PostResult } from "@/lib/api/types";

export type Plan = GetResult<"/plans">[number];
export type CheckoutOrder = PostResult<"/billing/checkout">;
export type RedeemedCoupon = PostResult<"/coupons/redeem">;
