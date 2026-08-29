import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { citext, primaryUuid, timestamps } from './_shared.js';
import { planTierEnum, subscriptionProviderEnum, subscriptionStatusEnum } from './enums.js';
import { users } from './users.js';

export const coupons = pgTable(
  'coupons',
  {
    id: primaryUuid(),
    code: citext('code').notNull(),
    tokenAmount: bigint('token_amount', { mode: 'bigint' }).notNull(),
    validTill: timestamp('valid_till', { withTimezone: true, mode: 'date' }),
    maxRedemptions: integer('max_redemptions'),
    redemptionCount: integer('redemption_count').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex('coupons_code_key').on(t.code)],
);

export const couponRedemptions = pgTable(
  'coupon_redemptions',
  {
    id: primaryUuid(),

    couponId: uuid('coupon_id')
      .notNull()
      .references(() => coupons.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    availedAt: timestamp('availed_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    tokensGranted: bigint('tokens_granted', { mode: 'bigint' }).notNull(),
  },
  (t) => [uniqueIndex('coupon_redemptions_coupon_user_key').on(t.couponId, t.userId)],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: primaryUuid(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    plan: planTierEnum('plan').notNull(),
    provider: subscriptionProviderEnum('provider').notNull(),
    providerOrderId: text('provider_order_id').notNull(),
    providerPaymentId: text('provider_payment_id'),
    status: subscriptionStatusEnum('status').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: text('currency').notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true, mode: 'date' }),
    payload: jsonb('payload'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('subscriptions_provider_order_key').on(t.provider, t.providerOrderId),
    index('subscriptions_user_status_idx').on(t.userId, t.status),
  ],
);

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: primaryUuid(),
    provider: text('provider').notNull(),
    eventId: text('event_id').notNull(),
    payload: jsonb('payload').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (t) => [uniqueIndex('webhook_events_provider_event_id_key').on(t.provider, t.eventId)],
);

export type CouponRow = typeof coupons.$inferSelect;
export type CouponRedemptionRow = typeof couponRedemptions.$inferSelect;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type WebhookEventRow = typeof webhookEvents.$inferSelect;
