import { and, eq, inArray, isNull, sql } from 'drizzle-orm';

import { toDisplayStatus } from '@/contract/index.js';
import { getDb } from '@/db/client.js';
import { chunks, type SourceRow, sources } from '@/db/schema/index.js';
import { inngest } from '@/inngest/client.js';
import { throwIngestionError } from '@/inngest/errors.js';
import { fetchYouTubePlaylist } from '@/integrations/youtube.js';
import { logger } from '@/observability/logger.js';
import { insertChildSource, updateSourceExtractionResult } from '@/repository/sources.repo.js';
import { findUserById } from '@/repository/users.repo.js';
import { assertPlaylistSize, limitsForTier } from '@/services/entitlements/index.js';
import { publishSourceEvent } from '@/services/source/events.js';

export interface PlaylistExpansionResult {
  parentSourceId: string;
  playlistId: string;
  childSourceIds: string[];
  playlistTitle: string;
}

export interface PlaylistExpanderInput {
  parent: SourceRow;
}

export async function expandYouTubePlaylist(
  input: PlaylistExpanderInput,
): Promise<PlaylistExpansionResult> {
  const { parent } = input;
  if (parent.type !== 'YOUTUBE_PLAYLIST') {
    throwIngestionError('EXTRACTION_FAILED', `Source ${parent.id} is not a YOUTUBE_PLAYLIST.`);
  }
  const playlistId = parent.mediaId;
  if (!playlistId) {
    throwIngestionError('EXTRACTION_FAILED', `Playlist source ${parent.id} has no mediaId.`);
  }

  const user = await findUserById(parent.userId);
  if (!user) {
    throwIngestionError('EXTRACTION_FAILED', `User ${parent.userId} not found.`);
  }
  const limits = limitsForTier(user.planTier);
  const maxItems = limits.maxPlaylistVideos === null ? 500 : limits.maxPlaylistVideos;

  const playlist = await fetchYouTubePlaylist(playlistId, maxItems);
  if (playlist.items.length === 0) {
    throwIngestionError(
      'EXTRACTION_FAILED',
      `Playlist ${playlistId} contained no playable videos.`,
    );
  }

  await assertPlaylistSize(parent.userId, playlist.items.length);

  if (playlist.title.trim().length > 0) {
    await updateSourceExtractionResult(parent.id, { title: playlist.title.trim() });
  }

  const childIds: string[] = [];
  for (const item of playlist.items) {
    const child = await insertChildSource({
      userId: parent.userId,
      workspaceId: parent.workspaceId,
      type: 'YOUTUBE_VIDEO',
      status: 'PENDING',
      title: item.title,
      originalRef: `https://www.youtube.com/watch?v=${item.videoId}`,
      mediaId: item.videoId,
      parentSourceId: parent.id,
    });
    childIds.push(child.id);
    await inngest.send({
      id: `source/ingest.requested:${child.id}`,
      name: 'source/ingest.requested',
      data: {
        sourceId: child.id,
        userId: parent.userId,
        workspaceId: parent.workspaceId,
      },
    });
  }

  logger.info(
    {
      playlistId,
      parentSourceId: parent.id,
      childCount: childIds.length,
      titleCount: playlist.totalItems,
    },
    'YouTube playlist expanded',
  );
  return {
    parentSourceId: parent.id,
    playlistId,
    childSourceIds: childIds,
    playlistTitle: playlist.title,
  };
}

export async function aggregatePlaylistProgress(
  parentSourceId: string,
): Promise<'READY' | 'FAILED' | null> {
  const db = getDb();
  const children = await db
    .select({ id: sources.id, status: sources.status, chunkCount: sources.chunkCount })
    .from(sources)
    .where(and(eq(sources.parentSourceId, parentSourceId), isNull(sources.deletedAt)));
  if (children.length === 0) return null;
  const terminal = new Set<SourceRow['status']>(['READY', 'FAILED', 'QUARANTINED']);
  const allTerminal = children.every((c) => terminal.has(c.status));
  if (!allTerminal) return null;
  const anySuccess = children.some((c) => c.status === 'READY');
  const nextStatus = anySuccess ? ('READY' as const) : ('FAILED' as const);
  const totalChunks = children.reduce((sum, c) => sum + c.chunkCount, 0);

  const [updated] = await db
    .update(sources)
    .set({ status: nextStatus, chunkCount: totalChunks, updatedAt: sql`now()` })
    .where(
      and(
        eq(sources.id, parentSourceId),
        inArray(sources.status, ['EXTRACTING', 'PENDING', 'CHUNKING']),
      ),
    )
    .returning();

  if (updated) {
    publishSourceEvent(updated.userId, updated.workspaceId, {
      type: 'source_status',
      data: {
        sourceId: updated.id,
        status: nextStatus,
        displayStatus: toDisplayStatus(nextStatus),
        chunkCount: totalChunks,
      },
    });
  }
  return nextStatus;
}

export async function countChunksForPlaylist(parentSourceId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: chunks.id })
    .from(chunks)
    .where(eq(chunks.sourceId, parentSourceId));
  return rows.length;
}
