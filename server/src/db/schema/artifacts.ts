import { bigint, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { primaryUuid, timestamps } from './_shared.js';
import { sources } from './sources.js';
import { users } from './users.js';

export const artifacts = pgTable('artifacts', {
  id: primaryUuid(),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => sources.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  status: text('status').notNull(),
  content: jsonb('content').notNull(),
  modelName: text('model_name'),
  consumedTokens: bigint('consumed_tokens', { mode: 'bigint' }),
  ...timestamps,
});

export type ArtifactRow = typeof artifacts.$inferSelect;
