import { sql } from 'drizzle-orm';
import { integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { deletedAtColumn, primaryUuid, timestamps } from './_shared.js';
import { users } from './users.js';

export const workspaces = pgTable(
  'workspaces',
  {
    id: primaryUuid(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    sourceCount: integer('source_count').notNull().default(0),
    deletedAt: deletedAtColumn(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('workspaces_user_lower_name_unique')
      .on(t.userId, sql`lower(${t.name})`)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

export type WorkspaceRow = typeof workspaces.$inferSelect;
export type NewWorkspaceRow = typeof workspaces.$inferInsert;
