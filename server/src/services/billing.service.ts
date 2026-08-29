import { randomUUID } from 'node:crypto';

import { env } from '@/config/env.js';
import {
  CUSTOM_PLAN_LIMITS,
  FREE_PLAN_LIMITS,
  type Plan,
  PLAN_LIMITS,
  type PlanTier,
  PRO_PLAN_LIMITS,
} from '@/contract/index.js';
import { AppError } from '@/errors/AppError.js';
import { createRazorpayOrder, verifyRazorpayWebhook } from '@/integrations/razorpay.js';
import { logger } from '@/observability/logger.js';
import { markWebhookProcessed, recordWebhookEvent } from '@/repository/billing.repo.js';
import {
  downgradeUserToFree,
  findSubscriptionByOrderId,
  insertPendingSubscription,
  markSubscriptionFailed,
  upgradeUserToPro,
} from '@/repository/subscription.repo.js';
import { redeemCoupon as redeemCouponAtomic } from '@/services/entitlements/coupons.js';
import type { CheckoutInput, CheckoutResult, WebhookResult } from '@/types/billing.types.js';

const PRO_PRICE_MINOR = 99900;
const DEFAULT_CURRENCY = 'INR';

export function listPlans(): readonly Plan[] {
  const free: Plan = {
    tier: 'FREE',
    displayName: 'Free',
    priceCents: 0,
    currency: DEFAULT_CURRENCY,
    interval: null,
    limits: { contactOnly: false as const, ...FREE_PLAN_LIMITS },
    features: [
      `Up to ${FREE_PLAN_LIMITS.maxWorkspaces} workspaces`,
      `${FREE_PLAN_LIMITS.maxSourcesPerWorkspace} sources per workspace`,
      `${(FREE_PLAN_LIMITS.lifetimeTokens ?? 0).toLocaleString('en-IN')} lifetime tokens`,
      'PDF, text, VTT, URL and YouTube sources',
    ],
  };
  const pro: Plan = {
    tier: 'PRO',
    displayName: 'Pro',

    priceCents: PRO_PRICE_MINOR,
    currency: DEFAULT_CURRENCY,
    interval: 'month',
    limits: { contactOnly: false as const, ...PRO_PLAN_LIMITS },
    features: [
      'Unlimited sources per workspace',
      'Unlimited lifetime tokens',
      `Up to ${PRO_PLAN_LIMITS.maxWorkspaces} workspaces`,
      `${(PRO_PLAN_LIMITS.maxFileBytes / (1024 * 1024)).toFixed(0)} MB uploads`,
    ],
  };
  const custom: Plan = {
    tier: 'CUSTOM',
    displayName: 'Custom',
    priceCents: 0,
    currency: DEFAULT_CURRENCY,
    interval: null,
    limits: CUSTOM_PLAN_LIMITS,
    features: ['Contact us for enterprise pricing and SSO'],
  };
  void PLAN_LIMITS;
  return [free, pro, custom];
}

export async function createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  if (input.planTier !== 'PRO') {
    throw new AppError(
      'VALIDATION_ERROR',
      'Checkout is only available for the PRO tier — contact sales for CUSTOM.',
    );
  }
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new AppError('INTERNAL_ERROR', 'Razorpay credentials are not configured.', {
      exposeDetails: false,
    });
  }

  const receipt = `pro-${input.userId.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
  const notes: Record<string, string> = {
    userId: input.userId,
    planTier: input.planTier,
    ...(input.couponCode ? { couponCode: input.couponCode } : {}),
  };
  const order = await createRazorpayOrder({
    amountMinor: PRO_PRICE_MINOR,
    currency: DEFAULT_CURRENCY,
    receipt,
    notes,
  });

  await insertPendingSubscription({
    userId: input.userId,
    providerOrderId: order.orderId,
    amountMinor: BigInt(PRO_PRICE_MINOR),
    currency: DEFAULT_CURRENCY,
  });

  return {
    orderId: order.orderId,
    keyId: env.RAZORPAY_KEY_ID,
  };
}

const COUPON_RATE_WINDOW_MS = 10 * 60 * 1000;
const COUPON_RATE_MAX_ATTEMPTS = 5;
const couponAttempts = new Map<string, number[]>();

function _resetCouponRateLimiter(): void {
  couponAttempts.clear();
}

export const __internals = { _resetCouponRateLimiter };

function bumpCouponAttempt(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - COUPON_RATE_WINDOW_MS;
  const list = (couponAttempts.get(userId) ?? []).filter((t) => t > cutoff);
  if (list.length >= COUPON_RATE_MAX_ATTEMPTS) {
    couponAttempts.set(userId, list);
    return false;
  }
  list.push(now);
  couponAttempts.set(userId, list);
  return true;
}

export async function redeemCouponForCurrentUser(
  userId: string,
  code: string,
): Promise<{ planTier: PlanTier; activatedAt: string; expiresAt: null; tokensGranted: number }> {
  if (!bumpCouponAttempt(userId)) {
    throw new AppError('RATE_LIMITED', 'Too many coupon redemption attempts. Try later.', {
      details: { retryAfterSeconds: COUPON_RATE_WINDOW_MS / 1000 },
      exposeDetails: true,
    });
  }

  try {
    const outcome = await redeemCouponAtomic(userId, code);
    return {
      planTier: 'FREE',
      activatedAt: new Date().toISOString(),
      expiresAt: null,
      tokensGranted: outcome.tokensGranted,
    };
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    const leakyCodes: readonly string[] = [
      'NOT_FOUND',
      'FORBIDDEN',
      'PLAN_LIMIT_EXCEEDED',
      'CONFLICT',
    ];
    if (leakyCodes.includes(err.code)) {
      logger.info(
        { event: 'coupon.redeem.rejected', userId, realCode: err.code },
        'coupon redemption rejected — surfacing uniform error',
      );
      throw new AppError('VALIDATION_ERROR', 'This coupon cannot be redeemed.', {
        exposeDetails: false,
      });
    }
    throw err;
  }
}

interface RazorpayWebhookEnvelope {
  event: string;
  payload: {
    payment?: { entity: RazorpayPaymentEntity };
    refund?: { entity: RazorpayRefundEntity };
    order?: { entity: { id: string; notes?: Record<string, string> } };
  };
}
interface RazorpayPaymentEntity {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  notes?: Record<string, string>;
}
interface RazorpayRefundEntity {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
  notes?: Record<string, string>;
}

function readEnvelope(raw: unknown): RazorpayWebhookEnvelope {
  if (raw === null || typeof raw !== 'object') {
    throw new AppError('VALIDATION_ERROR', 'Razorpay webhook payload is not an object.');
  }
  const r = raw as Record<string, unknown>;
  if (typeof r['event'] !== 'string') {
    throw new AppError('VALIDATION_ERROR', 'Razorpay webhook missing event.');
  }
  const payload = (r['payload'] as Record<string, unknown> | undefined) ?? {};
  return { event: r['event'], payload: payload };
}

async function resolveUserIdForEvent(
  order_id: string | undefined,
  notes: Record<string, string> | undefined,
): Promise<string | null> {
  if (notes?.['userId']) return notes['userId'];
  if (!order_id) return null;
  const sub = await findSubscriptionByOrderId(order_id);
  return sub?.userId ?? null;
}

export async function handleRazorpayWebhook(input: {
  rawBody: string;
  signature: string;
  eventId: string;
  parsed: unknown;
}): Promise<WebhookResult> {
  if (!input.signature) {
    throw new AppError('UNAUTHENTICATED', 'Missing x-razorpay-signature header.', {
      exposeDetails: false,
    });
  }
  if (!input.eventId) {
    throw new AppError('UNAUTHENTICATED', 'Missing x-razorpay-event-id header.', {
      exposeDetails: false,
    });
  }
  verifyRazorpayWebhook(input.rawBody, input.signature);

  const envelope = readEnvelope(input.parsed);

  const isFirst = await recordWebhookEvent('razorpay', input.eventId, envelope);
  if (!isFirst) {
    logger.info(
      { event: 'razorpay.webhook.replay', eventId: input.eventId, type: envelope.event },
      'razorpay webhook replay ignored',
    );
    return { received: true as const, handled: false };
  }

  let handled = false;
  switch (envelope.event) {
    case 'payment.captured': {
      const p = envelope.payload.payment?.entity;
      if (!p) break;
      const userId = await resolveUserIdForEvent(p.order_id, p.notes);
      if (!userId) {
        logger.warn(
          { event: 'razorpay.webhook.orphan', eventId: input.eventId, orderId: p.order_id },
          'payment.captured: could not resolve user',
        );
        break;
      }
      await upgradeUserToPro({
        userId,
        providerOrderId: p.order_id,
        providerPaymentId: p.id,
        amountMinor: BigInt(p.amount),
        currency: p.currency,
        payload: envelope,
      });
      handled = true;
      break;
    }
    case 'payment.failed': {
      const p = envelope.payload.payment?.entity;
      if (!p) break;
      await markSubscriptionFailed(p.order_id, envelope);
      handled = true;
      break;
    }
    case 'refund.processed':
    case 'refund.created': {
      const r = envelope.payload.refund?.entity;
      if (!r) break;
      const paymentOrderNotes = envelope.payload.payment?.entity;
      const orderId = paymentOrderNotes?.order_id;
      const userId = await resolveUserIdForEvent(orderId, r.notes ?? paymentOrderNotes?.notes);
      if (!userId || !orderId) {
        logger.warn(
          { event: 'razorpay.webhook.refund.orphan', eventId: input.eventId, refundId: r.id },
          'refund event: could not resolve user or order',
        );
        break;
      }
      await downgradeUserToFree({
        userId,
        providerOrderId: orderId,
        nextStatus: 'REFUNDED',
        payload: envelope,
      });
      handled = true;
      break;
    }
    default:
      logger.debug(
        { event: 'razorpay.webhook.ignored', type: envelope.event, eventId: input.eventId },
        'razorpay webhook event ignored (no handler)',
      );
      break;
  }

  await markWebhookProcessed('razorpay', input.eventId);
  return { received: true as const, handled };
}

export async function downgradeAtPeriodEnd(userId: string, orderId?: string): Promise<void> {
  await downgradeUserToFree({
    userId,
    ...(orderId ? { providerOrderId: orderId } : {}),
    nextStatus: 'CANCELED',
  });
}
