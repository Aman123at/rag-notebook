import { bigint, index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { primaryUuid, timestamps } from './_shared.js';
import { chats } from './chats.js';
import { tokenReservationKindEnum, tokenReservationStatusEnum } from './enums.js';
import { users } from './users.js';

export const tokenReservations = pgTable(
  'token_reservations',
  {
    id: primaryUuid(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    chatId: uuid('chat_id').references(() => chats.id, { onDelete: 'set null' }),
    kind: tokenReservationKindEnum('kind').notNull(),
    estimatedTokens: bigint('estimated_tokens', { mode: 'bigint' }).notNull(),
    status: tokenReservationStatusEnum('status').notNull().default('RESERVED'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    ...timestamps,
  },
  (t) => [index('token_reservations_user_status_idx').on(t.userId, t.status)],
);

export type TokenReservationRow = typeof tokenReservations.$inferSelect;
