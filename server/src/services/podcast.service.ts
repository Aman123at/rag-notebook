import { type Podcast } from '@/contract/index.js';
import { withTransaction } from '@/db/client.js';
import { type PodcastRow } from '@/db/schema/index.js';
import { AppError } from '@/errors/AppError.js';
import { sendEvent } from '@/inngest/events.js';
import { buildSignedInlineUrl, destroyRawAsset } from '@/integrations/cloudinary.js';
import {
  countSlotOccupyingPodcasts,
  deletePodcastForWorkspace,
  findPodcastForWorkspace,
  insertPodcast,
} from '@/repository/podcasts.repo.js';
import { listSourcesForWorkspace } from '@/repository/sources.repo.js';
import { lockUserRowForBudget } from '@/repository/users.repo.js';
import { findWorkspaceForUser } from '@/repository/workspaces.repo.js';
import { limitsForTier, upgradeUrl } from '@/services/entitlements/limits.js';
import { getBudget } from '@/services/entitlements/tokens.js';

/**
 * A floor below which we refuse to even start generation, so a user who is out of
 * tokens fails fast at the API rather than after a PENDING row is created. The
 * real reservation for the map-reduce happens inside the generation job.
 */
const MIN_TOKENS_TO_START = 2_000;

/** Signed audio URL TTL, mirrored to the client so it knows when to refetch. */
const AUDIO_URL_TTL_SECONDS = 3600;

function toWire(row: PodcastRow): Podcast {
  const status = row.status;
  let audioUrl: string | null = null;
  let audioUrlExpiresAt: string | null = null;
  if (status === 'READY' && row.audioPublicId) {
    const signed = buildSignedInlineUrl(row.audioPublicId, AUDIO_URL_TTL_SECONDS);
    audioUrl = signed.url;
    audioUrlExpiresAt = signed.expiresAt;
  }
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    status,
    audioUrl,
    audioUrlExpiresAt,
    durationSeconds: row.durationSeconds,
    isStale: row.isStale,
    staleReason: row.staleReason,
    failureReason: row.failureReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertWorkspaceOwned(userId: string, workspaceId: string): Promise<void> {
  const workspace = await findWorkspaceForUser(userId, workspaceId);
  if (!workspace) {
    throw new AppError('NOT_FOUND', 'Workspace not found.', { exposeDetails: false });
  }
}

/** The workspace podcast, or null if none exists. Mints a fresh URL when READY. */
export async function getWorkspacePodcast(
  userId: string,
  workspaceId: string,
): Promise<Podcast | null> {
  await assertWorkspaceOwned(userId, workspaceId);
  const row = await findPodcastForWorkspace(userId, workspaceId);
  return row ? toWire(row) : null;
}

/**
 * Generate the workspace's podcast. Enforces the concurrent slot cap and requires
 * a ready source, then inserts a PENDING row and dispatches the generation job.
 * Returns the PENDING podcast (the route replies 202).
 */
export async function createWorkspacePodcast(
  userId: string,
  workspaceId: string,
): Promise<Podcast> {
  await assertWorkspaceOwned(userId, workspaceId);

  // Require at least one ready source before spending anything.
  const sources = await listSourcesForWorkspace(userId, workspaceId);
  const hasReady = sources.some((s) => s.status === 'READY');
  if (!hasReady) {
    throw new AppError('SOURCE_NOT_READY', 'This workspace has no ready sources to summarize.', {
      exposeDetails: false,
    });
  }

  // Cheap budget floor-check; the map-reduce reserves precisely inside the job.
  const budget = await getBudget(userId);
  if (budget.remaining !== null && budget.remaining < MIN_TOKENS_TO_START) {
    throw new AppError('TOKEN_QUOTA_EXCEEDED', 'Not enough tokens remaining on your plan.', {
      details: { remaining: budget.remaining, needed: MIN_TOKENS_TO_START, plan: budget.assigned },
      exposeDetails: true,
    });
  }

  // Slot check + insert in ONE transaction under the user-row lock, closing the
  // cross-workspace double-generate race. The per-workspace UNIQUE constraint
  // closes the same-workspace race (surfaced as CONFLICT below).
  const row = await withTransaction(async (tx) => {
    const user = await lockUserRowForBudget(userId, tx);
    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found.', { exposeDetails: false });
    }
    const limits = limitsForTier(user.planTier);
    const cap = 'maxPodcasts' in limits ? limits.maxPodcasts : null;
    if (cap !== null) {
      const current = await countSlotOccupyingPodcasts(userId, tx);
      if (current >= cap) {
        throw new AppError(
          'PLAN_LIMIT_EXCEEDED',
          `Podcast limit reached (${cap}). Delete a podcast in any workspace to free a slot.`,
          {
            details: { limit: cap, current, plan: user.planTier, upgradeUrl: upgradeUrl() },
            exposeDetails: true,
          },
        );
      }
    }

    try {
      return await insertPodcast({ workspaceId, userId, status: 'PENDING' }, tx);
    } catch (err) {
      // Unique violation on workspace_id => a podcast already exists here.
      if (err instanceof Error && /podcasts_workspace_unique|unique/i.test(err.message)) {
        throw new AppError(
          'CONFLICT',
          'A podcast already exists for this workspace. Delete it before regenerating.',
          { exposeDetails: false },
        );
      }
      throw err;
    }
  });

  await sendEvent(
    'podcast/generate.requested',
    { podcastId: row.id, workspaceId, userId },
    { idempotencyKey: row.id },
  );

  return toWire(row);
}

/** Hard-delete the podcast and destroy its Cloudinary asset. Frees a slot. */
export async function deleteWorkspacePodcast(
  userId: string,
  workspaceId: string,
): Promise<{ id: string; deleted: true }> {
  await assertWorkspaceOwned(userId, workspaceId);
  const removed = await deletePodcastForWorkspace(userId, workspaceId);
  if (!removed) {
    throw new AppError('NOT_FOUND', 'No podcast to delete for this workspace.', {
      exposeDetails: false,
    });
  }
  if (removed.audioPublicId) {
    // Best-effort: the row is already gone; an orphaned asset is swept elsewhere.
    try {
      await destroyRawAsset(removed.audioPublicId);
    } catch {
      // swallow — deletion of the row is the source of truth.
    }
  }
  return { id: removed.id, deleted: true };
}
