import { toDisplayStatus } from '@/contract/index.js';
import { chunkId } from '@/db/chunk-id.js';
import { type SourceRow } from '@/db/schema/index.js';
import { chunkExtraction } from '@/ingestion/chunking/index.js';
import {
  type ExtractionResult as RealExtractionResult,
  runExtraction as runRealExtraction,
  toExtractorSource,
} from '@/ingestion/extractors/index.js';
import { indexSourceChunks } from '@/ingestion/indexing.service.js';
import { logger } from '@/observability/logger.js';
import { withSpan } from '@/observability/spans.js';
import { deleteChunksAtOrAbove, upsertChunksForSource } from '@/repository/chunks.repo.js';
import {
  nextIngestionAttemptNumber,
  recordIngestionQuarantine,
} from '@/repository/security.repo.js';
import {
  findSourceForUser,
  updateSourceExtractionResult,
  updateSourceStatus,
} from '@/repository/sources.repo.js';
import { scanForInjection } from '@/security/scanner.js';
import { publishSourceEvent } from '@/services/source/events.js';
import type {
  ChunkingResult,
  ExtractionResult,
  LoadedSource,
  ScanResult,
} from '@/types/sources.types.js';

type ExtractedContent = RealExtractionResult;

export async function loadSourceForIngestion(
  userId: string,
  sourceId: string,
): Promise<LoadedSource | null> {
  const row = await findSourceForUser(userId, sourceId);
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    workspaceId: row.workspaceId,
    type: row.type,
    title: row.title,
    originalRef: row.originalRef,
    status: row.status,
  };
}

export async function transitionSourceStatus(
  source: LoadedSource,
  next: SourceRow['status'],
  extras?: { chunkCount?: number },
): Promise<void> {
  const patch: Parameters<typeof updateSourceStatus>[1] = { status: next };
  if (extras?.chunkCount !== undefined) patch.chunkCount = extras.chunkCount;
  const updated = await updateSourceStatus(source.id, patch);
  if (!updated) return;
  publishSourceEvent(source.userId, source.workspaceId, {
    type: 'source_status',
    data: {
      sourceId: source.id,
      status: next,
      displayStatus: toDisplayStatus(next),
      chunkCount: updated.chunkCount,
    },
  });
}

export async function recordSourceFailure(
  source: Pick<LoadedSource, 'id' | 'userId' | 'workspaceId'>,
  failure: { code: string; message: string; retryable: boolean },
): Promise<void> {
  const updated = await updateSourceStatus(source.id, {
    status: 'FAILED',
    failureCode: failure.code,
    failureMessage: failure.message,
    failureRetryable: failure.retryable,
  });
  if (!updated) return;
  publishSourceEvent(source.userId, source.workspaceId, {
    type: 'source_status',
    data: {
      sourceId: source.id,
      status: 'FAILED',
      displayStatus: toDisplayStatus('FAILED'),
      chunkCount: updated.chunkCount,
    },
  });
}

export function runExtractionStub(source: LoadedSource): ExtractionResult {
  return { title: source.title, segmentCount: 1 };
}

async function persistResolvedTitle(
  source: LoadedSource,
  extraction: ExtractedContent,
): Promise<void> {
  const title = extraction.title.trim();
  if (title.length === 0) return;
  try {
    await updateSourceExtractionResult(source.id, {
      title,
      metadata: extraction.metadata,
      contentHash: extraction.contentHash,
    });
  } catch (err) {
    logger.warn(
      { event: 'ingestion.title.persist_failed', sourceId: source.id, err },
      'Could not persist resolved source title — continuing',
    );
  }
}

export async function runSecurityScanStub(source: LoadedSource): Promise<ScanResult> {
  return withSpan('security.scan', () => runSecurityScanInner(source), {
    'app.user_id': source.userId,
    'app.workspace_id': source.workspaceId,
    'app.source_id': source.id,
    'app.source_type': source.type,
    'security.stage': 'INGESTION',
  });
}

async function runSecurityScanInner(source: LoadedSource): Promise<ScanResult> {
  const row = await findSourceForUser(source.userId, source.id);
  if (!row) return { clean: true };
  const extraction: ExtractedContent = await withSpan(
    'extraction',
    () => runRealExtraction(toExtractorSource(row)),
    { 'app.source_id': source.id, 'app.source_type': source.type },
  );
  await persistResolvedTitle(source, extraction);
  const joined = extraction.segments.map((s) => s.text).join('\n\n');
  const outcome = scanForInjection(joined, 'INGESTION');
  if (outcome.clean) return { clean: true };

  const attemptNumber = await nextIngestionAttemptNumber(source.id);
  await recordIngestionQuarantine({
    userId: source.userId,
    sourceId: source.id,
    flags: {
      matches: outcome.matches,
      patternSetVersion: outcome.patternSetVersion,
      attemptNumber,
    },
  });

  await updateSourceStatus(source.id, {
    failureCode: 'SECURITY_QUARANTINED',
    failureMessage: `"${extraction.title.trim() || row.title}" was flagged during security scanning and was not indexed.`,
    failureRetryable: false,
  });
  logger.warn(
    {
      event: 'ingestion.security.quarantined',
      sourceId: source.id,
      userId: source.userId,
      workspaceId: source.workspaceId,
      patternSetVersion: outcome.patternSetVersion,
      matchedRuleIds: outcome.matches.map((m) => m.ruleId),
      highestSeverity: outcome.highestSeverity,
      attemptNumber,
    },
    'Source quarantined during ingestion security scan',
  );
  return { clean: false };
}

export async function runChunkingStub(source: LoadedSource): Promise<ChunkingResult> {
  return withSpan('chunking', () => runChunkingInner(source), {
    'app.user_id': source.userId,
    'app.workspace_id': source.workspaceId,
    'app.source_id': source.id,
    'app.source_type': source.type,
  });
}

async function runChunkingInner(source: LoadedSource): Promise<ChunkingResult> {
  const row = await findSourceForUser(source.userId, source.id);
  if (!row) return { chunkCount: 0 };
  const extraction: ExtractedContent = await withSpan(
    'extraction',
    () => runRealExtraction(toExtractorSource(row)),
    { 'app.source_id': source.id, 'app.source_type': source.type },
  );
  const produced = chunkExtraction(extraction);
  if (produced.length === 0) {
    await deleteChunksAtOrAbove(source.id, 0);
    return { chunkCount: 0 };
  }
  await upsertChunksForSource(
    source.id,
    produced.map((c) => ({
      chunkIndex: c.chunkIndex,
      sourceId: source.id,
      userId: source.userId,
      workspaceId: source.workspaceId,
      content: c.content,
      embeddingText: c.embeddingText,
      tokenCount: c.tokenCount,
      locator: c.locator,
      metadata: c.metadata ?? null,
    })),
  );
  await deleteChunksAtOrAbove(source.id, produced.length);
  return { chunkCount: produced.length };
}

export async function runIndexingStub(source: LoadedSource): Promise<{ indexed: number }> {
  const { indexed } = await indexSourceChunks({
    id: source.id,
    userId: source.userId,
    workspaceId: source.workspaceId,
  });
  return { indexed };
}

export function stubChunkIdForSource(sourceId: string): string {
  return chunkId(sourceId, 0);
}
