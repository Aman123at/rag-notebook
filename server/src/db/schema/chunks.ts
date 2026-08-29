import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { sources } from './sources.js';
import { users } from './users.js';
import { workspaces } from './workspaces.js';

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),

    embeddingText: text('embedding_text'),
    tokenCount: integer('token_count').notNull(),
    locator: jsonb('locator').notNull(),

    metadata: jsonb('metadata'),

    locatorKind: text('locator_kind').generatedAlwaysAs(sql`(locator ->> 'kind')`),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),

    docLength: bigint('doc_length', { mode: 'bigint' }),
  },
  (t) => [
    uniqueIndex('chunks_source_chunk_index_key').on(t.sourceId, t.chunkIndex),
    index('chunks_source_id_idx').on(t.sourceId),
    index('chunks_workspace_id_idx').on(t.workspaceId),
    index('chunks_locator_kind_idx').on(t.locatorKind),
  ],
);

export type ChunkRow = typeof chunks.$inferSelect;
export type NewChunkRow = typeof chunks.$inferInsert;
