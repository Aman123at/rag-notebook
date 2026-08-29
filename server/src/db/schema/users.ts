import { sql } from 'drizzle-orm';
import { bigint, boolean, index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { citext, primaryUuid, timestamps } from './_shared.js';
import { planTierEnum } from './enums.js';

export const users = pgTable(
  'users',
  {
    id: primaryUuid(),
    clerkUserId: text('clerk_user_id').notNull(),
    email: citext('email').notNull(),
    displayName: text('display_name'),

    signUpType: text('sign_up_type'),
    planTier: planTierEnum('plan_tier').notNull().default('FREE'),
    assignedTokens: bigint('assigned_tokens', { mode: 'bigint' }),
    usedTokensEmbedding: bigint('used_tokens_embedding', { mode: 'bigint' })
      .notNull()
      .default(sql`0::bigint`),
    usedTokensCompletion: bigint('used_tokens_completion', { mode: 'bigint' })
      .notNull()
      .default(sql`0::bigint`),
    isActive: boolean('is_active').notNull().default(true),
    isBlocked: boolean('is_blocked').notNull().default(false),
    blockedAt: timestamp('blocked_at', { withTimezone: true, mode: 'date' }),
    blockedReason: text('blocked_reason'),
    planUpdatedAt: timestamp('plan_updated_at', { withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_clerk_user_id_key').on(t.clerkUserId),
    uniqueIndex('users_email_key').on(t.email),
    index('users_plan_tier_idx').on(t.planTier),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
