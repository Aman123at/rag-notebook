import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { primaryUuid, timestamps } from './_shared.js';
import { podcastStaleReasonEnum, podcastStatusEnum } from './enums.js';
import { users } from './users.js';
import { workspaces } from './workspaces.js';

/**
 * One audio overview per workspace. Hard delete (no `deletedAt`): a podcast is
 * derived data that can always be regenerated from sources, and deleting it must
 * free a concurrency slot immediately with no soft-delete filtering to remember.
 *
 * `script` holds the internal two-host dialogue as JSONB for diagnostics; it is
 * never serialized to the client (see PodcastSchema in the contract).
 * `audioPublicId` is the Cloudinary raw-asset id; the signed inline URL is minted
 * per request and never stored.
 */
export const podcasts = pgTable(
  'podcasts',
  {
    id: primaryUuid(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: podcastStatusEnum('status').notNull().default('PENDING'),
    audioPublicId: text('audio_public_id'),
    durationSeconds: integer('duration_seconds'),
    script: jsonb('script'),
    scriptModel: text('script_model'),
    ttsModel: text('tts_model'),
    consumedTokens: bigint('consumed_tokens', { mode: 'bigint' }),
    isStale: boolean('is_stale').notNull().default(false),
    staleReason: podcastStaleReasonEnum('stale_reason'),
    failureReason: text('failure_reason'),
    ...timestamps,
  },
  (t) => [
    // Exactly one podcast per workspace. Hard delete means no partial predicate is
    // needed — a plain unique constraint closes the double-generate race in-workspace.
    uniqueIndex('podcasts_workspace_unique').on(t.workspaceId),
  ],
);

export type PodcastRow = typeof podcasts.$inferSelect;
export type NewPodcastRow = typeof podcasts.$inferInsert;
