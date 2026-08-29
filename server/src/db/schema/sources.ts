import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';

import { deletedAtColumn, primaryUuid, timestamps } from './_shared.js';
import { sourceStatusEnum, sourceTypeEnum } from './enums.js';
import { users } from './users.js';
import { workspaces } from './workspaces.js';

export const sources = pgTable(
  'sources',
  {
    id: primaryUuid(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentSourceId: uuid('parent_source_id').references((): AnyPgColumn => sources.id, {
      onDelete: 'cascade',
    }),
    type: sourceTypeEnum('type').notNull(),
    status: sourceStatusEnum('status').notNull().default('PENDING'),
    title: text('title').notNull(),
    originalRef: text('original_ref').notNull(),
    mediaId: text('media_id'),
    storagePublicId: text('storage_public_id'),
    mimeType: text('mime_type'),
    sizeBytes: bigint('size_bytes', { mode: 'bigint' }),
    contentHash: text('content_hash'),
    chunkCount: integer('chunk_count').notNull().default(0),
    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),
    failureRetryable: boolean('failure_retryable'),
    securityFlags: jsonb('security_flags'),
    metadata: jsonb('metadata'),
    deletedAt: deletedAtColumn(),
    ...timestamps,
  },
  (t) => [
    index('sources_workspace_id_live_idx')
      .on(t.workspaceId)
      .where(sql`${t.deletedAt} IS NULL`),
    index('sources_user_status_idx').on(t.userId, t.status),
    index('sources_parent_source_id_idx').on(t.parentSourceId),
    index('sources_workspace_content_hash_idx').on(t.workspaceId, t.contentHash),
  ],
);

export type SourceRow = typeof sources.$inferSelect;
export type NewSourceRow = typeof sources.$inferInsert;
