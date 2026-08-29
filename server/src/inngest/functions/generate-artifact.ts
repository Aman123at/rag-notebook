import { aggregatePlaylistProgress } from '@/ingestion/extractors/playlist.js';
import { inngest } from '@/inngest/client.js';
import {
  ArtifactGenerateRequested,
  SourceIngestCompleted,
  SourceIngestFailed,
} from '@/inngest/events.js';
import { runPlaylistRoadmapGeneration } from '@/inngest/jobs/playlist-roadmap.js';
import { findSourceById } from '@/repository/sources.repo.js';
import { maybeGeneratePlaylistRoadmap } from '@/services/artifact.service.js';

export const playlistArtifactAggregatorFunction = inngest.createFunction(
  {
    id: 'artifact-playlist-aggregator',
    name: 'Aggregate playlist children → schedule roadmap',
    triggers: [{ event: 'source/ingest.completed' }, { event: 'source/ingest.failed' }],

    concurrency: { key: 'event.data.userId', limit: 3, scope: 'env' },
    retries: 2,
  },
  async ({ event, step }) => {
    const shape =
      event.name === 'source/ingest.completed' ? SourceIngestCompleted : SourceIngestFailed;
    const parsed = shape.parse(event.data);
    const { sourceId } = parsed;

    const child = await step.run('load-child', async () => {
      return findSourceById(sourceId);
    });
    if (!child || !child.parentSourceId) {
      return { skipped: 'not-a-child', sourceId };
    }

    const parentStatus = await step.run('aggregate-parent-status', async () => {
      return aggregatePlaylistProgress(child.parentSourceId as string);
    });
    const scheduled = await step.run('maybe-schedule', async () => {
      return maybeGeneratePlaylistRoadmap(child.parentSourceId as string);
    });
    return {
      sourceId,
      parentSourceId: child.parentSourceId,
      parentStatus,
      scheduledArtifactId: scheduled,
    };
  },
);

export const generateArtifactFunction = inngest.createFunction(
  {
    id: 'artifact-generate',
    name: 'Generate artifact',
    triggers: [{ event: 'artifact/generate.requested' }],

    concurrency: { key: 'event.data.userId', limit: 2, scope: 'env' },
    retries: 2,
  },
  async ({ event, step }) => {
    const parsed = ArtifactGenerateRequested.parse(event.data);
    const result = await step.run('run-generator', async () => {
      return runPlaylistRoadmapGeneration({
        artifactId: parsed.artifactId,
        sourceId: parsed.sourceId,
        userId: parsed.userId,
        workspaceId: parsed.workspaceId,
      });
    });
    return result;
  },
);
