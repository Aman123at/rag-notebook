import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { primaryUuid } from './_shared.js';
import { attackDetectorEnum, attackStageEnum, attackTypeEnum } from './enums.js';
import { messages } from './messages.js';
import { sources } from './sources.js';
import { users } from './users.js';

export const attackAttempts = pgTable(
  'attack_attempts',
  {
    id: primaryUuid(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    attackType: attackTypeEnum('attack_type').notNull(),
    stage: attackStageEnum('stage').notNull(),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
    sourceId: uuid('source_id').references(() => sources.id, { onDelete: 'set null' }),
    attemptNumber: integer('attempt_number').notNull(),
    detector: attackDetectorEnum('detector').notNull(),
    matchedRules: text('matched_rules').array().notNull(),
    excerpt: text('excerpt').notNull(),
    attemptedAt: timestamp('attempted_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('attack_attempts_user_idx').on(t.userId, t.attemptedAt),
    index('attack_attempts_source_idx').on(t.sourceId),
  ],
);

export type AttackAttemptRow = typeof attackAttempts.$inferSelect;
export type NewAttackAttemptRow = typeof attackAttempts.$inferInsert;
