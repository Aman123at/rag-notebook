import { z } from 'zod';

import { defineRouteDefinition } from '../common/route.js';
import { PlanTierSchema } from '../domain/enums.js';
import { PlanLimitsSchema } from '../domain/plan.js';

export const PlanSchema = z.object({
  tier: PlanTierSchema,
  displayName: z.string(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  interval: z.enum(['month', 'year', 'once']).nullable(),
  limits: PlanLimitsSchema,
  
  features: z.array(z.string()),
});
export type Plan = z.infer<typeof PlanSchema>;

export const RedeemCouponBodySchema = z.object({
  code: z.string().min(1).max(64),
});
export const RedeemCouponResponseSchema = z.object({
  planTier: PlanTierSchema,
  activatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  




  tokensGranted: z.number().int().nonnegative(),
});

export const CheckoutBodySchema = z.object({
  planTier: PlanTierSchema,
  couponCode: z.string().max(64).optional(),
});







export const CheckoutResponseSchema = z.object({
  orderId: z.string(),
  keyId: z.string(),
});


export const RazorpayWebhookBodySchema = z.record(z.string(), z.unknown());

export const billingRoutes = {
  'billing.plans': defineRouteDefinition({
    method: 'GET',
    path: '/plans',
    auth: 'public',
    params: z.object({}),
    query: z.object({}),
    body: z.object({}),
    response: z.array(PlanSchema),
    errors: ['INTERNAL_ERROR'],
    tags: ['billing'],
    summary: 'Public plan catalogue.',
  }),
  'billing.redeemCoupon': defineRouteDefinition({
    method: 'POST',
    path: '/coupons/redeem',
    auth: 'required',
    params: z.object({}),
    query: z.object({}),
    body: RedeemCouponBodySchema,
    response: RedeemCouponResponseSchema,
    errors: [
      'UNAUTHENTICATED',
      'VALIDATION_ERROR',
      'RATE_LIMITED',
      'INTERNAL_ERROR',
    ],
    tags: ['billing'],
    summary: 'Redeem a plan coupon for the caller.'
  }),
  'billing.checkout': defineRouteDefinition({
    method: 'POST',
    path: '/billing/checkout',
    auth: 'required',
    params: z.object({}),
    query: z.object({}),
    body: CheckoutBodySchema,
    response: CheckoutResponseSchema,
    errors: [
      'UNAUTHENTICATED',
      'VALIDATION_ERROR',
      'CONFLICT',
      'UPSTREAM_ERROR',
      'INTERNAL_ERROR',
    ],
    tags: ['billing'],
    summary: 'Start a Razorpay checkout for an upgrade.',
  }),
  'billing.razorpayWebhook': defineRouteDefinition({
    method: 'POST',
    path: '/webhooks/razorpay',
    auth: 'webhook',
    params: z.object({}),
    query: z.object({}),
    body: RazorpayWebhookBodySchema,
    response: z.object({ received: z.literal(true) }),
    errors: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'INTERNAL_ERROR'],
    tags: ['billing', 'webhooks'],
    summary: 'Razorpay payment lifecycle webhook.',
  }),
} as const;
