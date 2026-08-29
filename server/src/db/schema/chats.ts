import { sql } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { deletedAtColumn, primaryUuid, timestamps } from './_shared.js';
import { users } from './users.js';
import { workspaces } from './workspaces.js';

export const chats = pgTable(
  'chats',
  {
    id: primaryUuid(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    summary: text('summary'),
    summaryUpdatedAt: timestamp('summary_updated_at', { withTimezone: true, mode: 'date' }),
    messageCount: integer('message_count').notNull().default(0),
    isArchived: boolean('is_archived').notNull().default(false),
    isPublic: boolean('is_public').notNull().default(false),
    publicSlug: text('public_slug'),
    deletedAt: deletedAtColumn(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('chats_public_slug_key')
      .on(t.publicSlug)
      .where(sql`${t.publicSlug} IS NOT NULL`),

    uniqueIndex('chats_workspace_id_singleton_key')
      .on(t.workspaceId)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

export type ChatRow = typeof chats.$inferSelect;
export type NewChatRow = typeof chats.$inferInsert;
