import { NonRetriableError } from 'inngest';

import { AppError } from '@/errors/AppError.js';
import { expandYouTubePlaylist } from '@/ingestion/extractors/playlist.js';
import { inngest } from '@/inngest/client.js';
import { coerceIngestionFailure } from '@/inngest/errors.js';
import { SourceIngestRequested } from '@/inngest/events.js';
import { logger } from '@/observability/logger.js';
import { findSourceForUser } from '@/repository/sources.repo.js';
import {
  loadSourceForIngestion,
  recordSourceFailure,
  runChunkingStub,
  runExtractionStub,
  runIndexingStub,
  runSecurityScanStub,
  transitionSourceStatus,
} from '@/services/source-processing.service.js';

export async function handleIngestFailure(args: {
  event: { data: { event: { data: unknown } } };
  error: unknown;
}): Promise<void> {
  const wrapped = args.event.data.event;
  const parsed = SourceIngestRequested.safeParse(wrapped.data);
  if (!parsed.success) {
    logger.error(
      { failure: 'ingest.onFailure', issues: parsed.error.issues },
      'ingest onFailure received a malformed inner event',
    );
    return;
  }
  const { sourceId, userId, workspaceId } = parsed.data;
  const failure = coerceIngestionFailure(args.error);
  await recordSourceFailure({ id: sourceId, userId, workspaceId }, failure);
  await inngest.send({
    id: `source/ingest.failed:${sourceId}`,
    name: 'source/ingest.failed',
    data: {
      sourceId,
      userId,
      workspaceId,
      failureCode: failure.code,
      failureMessage: failure.message,
      failureRetryable: failure.retryable,
    },
  });
}

export const ingestSourceFunction = inngest.createFunction(
  {
    id: 'ingest-source',
    name: 'Ingest source',
    triggers: [{ event: 'source/ingest.requested' }],

    concurrency: { key: 'event.data.userId', limit: 5, scope: 'env' },
    retries: 3,
    onFailure: handleIngestFailure,
  },
  async ({ event, step }) => {
    const parsed = SourceIngestRequested.parse(event.data);
    const { sourceId, userId, workspaceId } = parsed;

    const loaded = await step.run('load-source', async () => {
      return loadSourceForIngestion(userId, sourceId);
    });
    if (!loaded) {
      return { skipped: 'source-not-found', sourceId };
    }

    if (loaded.workspaceId !== workspaceId) {
      throw new NonRetriableError(
        `Event workspaceId does not match source row (${loaded.workspaceId} vs ${workspaceId})`,
        { cause: new AppError('FORBIDDEN', 'Cross-tenant ingestion event refused.') },
      );
    }

    if (loaded.status === 'READY') {
      return { skipped: 'already-ready', sourceId };
    }
    if (loaded.status === 'QUARANTINED') {
      return { skipped: 'quarantined', sourceId };
    }

    await step.run('mark-extracting', async () => {
      await transitionSourceStatus(loaded, 'EXTRACTING');
    });

    if (loaded.type === 'YOUTUBE_PLAYLIST') {
      const expansion = await step.run('expand-playlist', async () => {
        const row = await findSourceForUser(loaded.userId, loaded.id);
        if (!row) return null;
        return expandYouTubePlaylist({ parent: row });
      });
      if (!expansion) {
        return { skipped: 'source-not-found', sourceId };
      }
      return {
        sourceId,
        status: 'EXPANDED' as const,
        childCount: expansion.childSourceIds.length,
      };
    }

    const extraction = await step.run('extract', () => {
      return runExtractionStub(loaded);
    });

    await step.run('mark-scanning', async () => {
      await transitionSourceStatus(loaded, 'SCANNING');
    });

    const scan = await step.run('scan', async () => {
      return runSecurityScanStub(loaded);
    });

    if (!scan.clean) {
      await step.run('mark-quarantined', async () => {
        await transitionSourceStatus(loaded, 'QUARANTINED');
      });
      return { sourceId, status: 'QUARANTINED' as const, extraction };
    }

    await step.run('mark-chunking', async () => {
      await transitionSourceStatus(loaded, 'CHUNKING');
    });

    const chunking = await step.run('chunk', async () => {
      return runChunkingStub(loaded);
    });

    await step.run('mark-chunked', async () => {
      await transitionSourceStatus(loaded, 'CHUNKED', { chunkCount: chunking.chunkCount });
    });

    await step.run('mark-indexing', async () => {
      await transitionSourceStatus(loaded, 'INDEXING');
    });

    await step.run('index', async () => {
      return runIndexingStub(loaded);
    });

    await step.run('mark-ready', async () => {
      await transitionSourceStatus(loaded, 'READY', { chunkCount: chunking.chunkCount });
    });

    await step.run('emit-completed', async () => {
      await inngest.send({
        id: `source/ingest.completed:${sourceId}`,
        name: 'source/ingest.completed',
        data: {
          sourceId,
          userId,
          workspaceId,
          chunkCount: chunking.chunkCount,
        },
      });
    });

    return { sourceId, status: 'READY' as const, chunkCount: chunking.chunkCount };
  },
);
