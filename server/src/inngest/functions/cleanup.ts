import { eq } from 'drizzle-orm';

import { getDb } from '@/db/client.js';
import { chunks } from '@/db/schema/index.js';
import { inngest } from '@/inngest/client.js';
import {
  SourceCleanupRequested,
  UserCleanupRequested,
  WorkspaceCleanupRequested,
} from '@/inngest/events.js';
import { destroyRawAsset } from '@/integrations/cloudinary.js';
import { deleteBySourceId, deleteByUserId, deleteByWorkspaceId } from '@/integrations/qdrant.js';
import {
  deletePodcastForWorkspaceSystem,
  deletePodcastsForUser,
  listPodcastAudioForUser,
} from '@/repository/podcasts.repo.js';
import { listStoragePublicIdsForWorkspace } from '@/repository/sources.repo.js';

export const cleanupSourceFunction = inngest.createFunction(
  {
    id: 'cleanup-source',
    name: 'Cleanup source',
    triggers: [{ event: 'source/cleanup.requested' }],
  },
  async ({ event, step }) => {
    const { sourceId } = SourceCleanupRequested.parse(event.data);
    const chunkCount = await step.run('delete-chunks', async () => {
      const deleted = await getDb()
        .delete(chunks)
        .where(eq(chunks.sourceId, sourceId))
        .returning({ id: chunks.id });
      return deleted.length;
    });
    await step.run('delete-qdrant-points', async () => {
      await deleteBySourceId(sourceId);
    });
    return { sourceId, chunkCount };
  },
);

export const cleanupWorkspaceFunction = inngest.createFunction(
  {
    id: 'cleanup-workspace',
    name: 'Cleanup workspace',
    triggers: [{ event: 'workspace/cleanup.requested' }],
  },
  async ({ event, step }) => {
    const { workspaceId } = WorkspaceCleanupRequested.parse(event.data);
    const chunkCount = await step.run('delete-chunks', async () => {
      const deleted = await getDb()
        .delete(chunks)
        .where(eq(chunks.workspaceId, workspaceId))
        .returning({ id: chunks.id });
      return deleted.length;
    });
    await step.run('delete-qdrant-points', async () => {
      await deleteByWorkspaceId(workspaceId);
    });

    const publicIds = await step.run('list-cloudinary-public-ids', () =>
      listStoragePublicIdsForWorkspace(workspaceId),
    );
    for (const publicId of publicIds) {
      await step.run(`destroy-cloudinary:${publicId}`, () => destroyRawAsset(publicId));
    }

    // The workspace is soft-deleted, so the FK cascade never removes the podcast:
    // read its audio id, destroy the asset, then hard-delete the row (frees the slot).
    const podcastAudioId = await step.run('delete-podcast-row', async () => {
      const removed = await deletePodcastForWorkspaceSystem(workspaceId);
      return removed?.audioPublicId ?? null;
    });
    if (podcastAudioId) {
      await step.run('destroy-podcast-audio', () => destroyRawAsset(podcastAudioId));
    }
    return { workspaceId, chunkCount, cloudinaryDestroyed: publicIds.length };
  },
);

export const cleanupUserFunction = inngest.createFunction(
  {
    id: 'cleanup-user',
    name: 'Cleanup user',
    triggers: [{ event: 'user/cleanup.requested' }],
  },
  async ({ event, step }) => {
    const { userId } = UserCleanupRequested.parse(event.data);
    const chunkCount = await step.run('delete-chunks', async () => {
      const deleted = await getDb()
        .delete(chunks)
        .where(eq(chunks.userId, userId))
        .returning({ id: chunks.id });
      return deleted.length;
    });
    await step.run('delete-qdrant-points', async () => {
      await deleteByUserId(userId);
    });

    // Reclaim every podcast MP3 the user owns, then hard-delete the rows.
    const podcastAudioIds = await step.run('list-podcast-audio', async () => {
      const rows = await listPodcastAudioForUser(userId);
      return rows.map((r) => r.audioPublicId).filter((id): id is string => id !== null);
    });
    for (const publicId of podcastAudioIds) {
      await step.run(`destroy-podcast-audio:${publicId}`, () => destroyRawAsset(publicId));
    }
    const podcastCount = await step.run('delete-podcast-rows', () => deletePodcastsForUser(userId));
    return { userId, chunkCount, podcastCount };
  },
);
