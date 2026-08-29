import type { PlanTier } from '@/contract/index.js';

export interface CheckoutInput {
  userId: string;
  planTier: PlanTier;
  couponCode?: string | undefined;
}

export interface CheckoutResult {
  orderId: string;
  keyId: string;
}

export interface WebhookResult {
  received: true;
  handled: boolean;
}
