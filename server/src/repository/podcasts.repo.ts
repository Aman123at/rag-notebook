import { and, eq, inArray, sql } from 'drizzle-orm';

import { exec, type Executor } from '@/db/client.js';
import { type NewPodcastRow, type PodcastRow, podcasts } from '@/db/schema/index.js';

/**
 * Statuses that occupy a concurrency slot: everything except FAILED. A failed
 * podcast frees its slot instantly (per the slot rules); an in-flight one still
 * holds one so a user at the cap cannot fire many concurrent generations.
 */
export const SLOT_OCCUPYING_STATUSES = [
  'PENDING',
  'SCRIPTING',
  'SYNTHESIZING',
  'READY',
] as const;

export async function findPodcastForWorkspace(
  userId: string,
  workspaceId: string,
  tx?: Executor,
): Promise<PodcastRow | null> {
  const rows = await exec(tx)
    .select()
    .from(podcasts)
    .where(and(eq(podcasts.userId, userId), eq(podcasts.workspaceId, workspaceId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findPodcastById(
  userId: string,
  podcastId: string,
  tx?: Executor,
): Promise<PodcastRow | null> {
  const rows = await exec(tx)
    .select()
    .from(podcasts)
    .where(and(eq(podcasts.userId, userId), eq(podcasts.id, podcastId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Count the caller's slot-occupying podcasts across ALL workspaces. */
export async function countSlotOccupyingPodcasts(userId: string, tx?: Executor): Promise<number> {
  const [row] = await exec(tx)
    .select({ count: sql<number>`count(*)::int` })
    .from(podcasts)
    .where(
      and(
        eq(podcasts.userId, userId),
        inArray(podcasts.status, SLOT_OCCUPYING_STATUSES),
      ),
    );
  return row?.count ?? 0;
}

export async function insertPodcast(row: NewPodcastRow, tx?: Executor): Promise<PodcastRow> {
  const [inserted] = await exec(tx).insert(podcasts).values(row).returning();
  if (!inserted) throw new Error('insertPodcast: no row returned');
  return inserted;
}

export async function updatePodcast(
  podcastId: string,
  patch: Partial<
    Pick<
      PodcastRow,
      | 'status'
      | 'audioPublicId'
      | 'durationSeconds'
      | 'script'
      | 'scriptModel'
      | 'ttsModel'
      | 'consumedTokens'
      | 'isStale'
      | 'staleReason'
      | 'failureReason'
    >
  >,
  tx?: Executor,
): Promise<PodcastRow | null> {
  const [updated] = await exec(tx)
    .update(podcasts)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(eq(podcasts.id, podcastId))
    .returning();
  return updated ?? null;
}

/** Mark a workspace's podcast stale (display-only; never triggers work). */
export async function markPodcastStaleForWorkspace(
  workspaceId: string,
  reason: PodcastRow['staleReason'],
  tx?: Executor,
): Promise<void> {
  await exec(tx)
    .update(podcasts)
    .set({ isStale: true, staleReason: reason, updatedAt: sql`now()` })
    .where(eq(podcasts.workspaceId, workspaceId));
}

/**
 * System-side hard-delete for a workspace's podcast (NO userId filter): used by the
 * cleanup cascade, which runs without a caller. Returns the removed row so the
 * caller can destroy its Cloudinary asset. Workspaces are soft-deleted, so the FK
 * cascade never fires — this is what actually frees the leaked slot and the asset.
 */
export async function deletePodcastForWorkspaceSystem(
  workspaceId: string,
  tx?: Executor,
): Promise<PodcastRow | null> {
  const [deleted] = await exec(tx)
    .delete(podcasts)
    .where(eq(podcasts.workspaceId, workspaceId))
    .returning();
  return deleted ?? null;
}

/** Every audio public id + id for a user's podcasts, for the user-cleanup cascade. */
export async function listPodcastAudioForUser(
  userId: string,
  tx?: Executor,
): Promise<{ id: string; audioPublicId: string | null }[]> {
  return exec(tx)
    .select({ id: podcasts.id, audioPublicId: podcasts.audioPublicId })
    .from(podcasts)
    .where(eq(podcasts.userId, userId));
}

/** Delete all of a user's podcast rows (assets destroyed separately first). */
export async function deletePodcastsForUser(userId: string, tx?: Executor): Promise<number> {
  const deleted = await exec(tx)
    .delete(podcasts)
    .where(eq(podcasts.userId, userId))
    .returning({ id: podcasts.id });
  return deleted.length;
}

/** Hard-delete and return the removed row (so the caller can destroy the asset). */
export async function deletePodcastForWorkspace(
  userId: string,
  workspaceId: string,
  tx?: Executor,
): Promise<PodcastRow | null> {
  const [deleted] = await exec(tx)
    .delete(podcasts)
    .where(and(eq(podcasts.userId, userId), eq(podcasts.workspaceId, workspaceId)))
    .returning();
  return deleted ?? null;
}
