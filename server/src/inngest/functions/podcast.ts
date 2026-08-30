import { inngest } from '@/inngest/client.js';
import {
  PodcastGenerateRequested,
  SourceCleanupRequested,
  SourceIngestCompleted,
} from '@/inngest/events.js';
import { runPodcastGeneration } from '@/inngest/jobs/podcast-generate.js';
import { markPodcastStaleForWorkspace } from '@/repository/podcasts.repo.js';

/**
 * Consume `podcast/generate.requested` and run the full corpus → script → TTS →
 * concat → upload pipeline. One podcast per user at a time (concurrency 1 keyed on
 * userId): generation is expensive and the slot cap already bounds how many can be
 * queued. retries: 1 — re-running re-charges summaries/TTS, so we retry once at
 * most; the per-turn TTS retry inside the job absorbs transient 429/5xx.
 */
export const generatePodcastFunction = inngest.createFunction(
  {
    id: 'podcast-generate',
    name: 'Generate podcast',
    triggers: [{ event: 'podcast/generate.requested' }],
    concurrency: { key: 'event.data.userId', limit: 1, scope: 'env' },
    retries: 1,
  },
  async ({ event, step }) => {
    const parsed = PodcastGenerateRequested.parse(event.data);
    return step.run('run-podcast-generation', () =>
      runPodcastGeneration({
        podcastId: parsed.podcastId,
        workspaceId: parsed.workspaceId,
        userId: parsed.userId,
      }),
    );
  },
);

/**
 * Mark a workspace's podcast stale when its READY corpus changes: a source became
 * READY, or a source was removed. Deliberately NOT triggered by `ingest.failed` —
 * a source that never entered the corpus does not change the podcast. Idempotent
 * (`isStale=true`), so repeated fires (e.g. per playlist child on delete) are safe.
 */
export const markPodcastStaleFunction = inngest.createFunction(
  {
    id: 'podcast-mark-stale',
    name: 'Mark podcast stale on source change',
    triggers: [{ event: 'source/ingest.completed' }, { event: 'source/cleanup.requested' }],
    retries: 2,
  },
  async ({ event, step }) => {
    const shape =
      event.name === 'source/ingest.completed' ? SourceIngestCompleted : SourceCleanupRequested;
    const { workspaceId } = shape.parse(event.data);
    await step.run('mark-stale', () => markPodcastStaleForWorkspace(workspaceId, 'SOURCES_CHANGED'));
    return { workspaceId };
  },
);
