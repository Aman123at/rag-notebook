import { and, eq, sql } from 'drizzle-orm';

import { getDb, withTransaction } from '@/db/client.js';
import { chunks, sources } from '@/db/schema/index.js';
import { isAppError } from '@/errors/AppError.js';
import { sparseEncoder } from '@/ingestion/sparse/encoder.js';
import { throwIngestionError } from '@/inngest/errors.js';
import {
  embedBatch,
  estimateEmbeddingTokens,
  packEmbeddingBatches,
} from '@/integrations/openai.js';
import {
  type ChunkPayload,
  deleteStaleTail,
  type DensePointInput,
  ensureQdrantCollection,
  upsertPoints,
  verifyPointExists,
} from '@/integrations/qdrant.js';
import { logger } from '@/observability/logger.js';
import { withSpan } from '@/observability/spans.js';
import { bumpDocFrequencies, bumpTotalDocs } from '@/repository/lexical.repo.js';
import { findSourceForUser } from '@/repository/sources.repo.js';
import {
  commitReservation,
  releaseReservation,
  reserveTokens,
} from '@/services/entitlements/index.js';

export interface IndexingResult {
  indexed: number;
  embeddingTokens: number;
}

export interface IndexSourceInput {
  id: string;
  userId: string;
  workspaceId: string;
}

export async function indexSourceChunks(input: IndexSourceInput): Promise<IndexingResult> {
  await ensureQdrantCollection();

  const sourceRow = await findSourceForUser(input.userId, input.id);
  if (!sourceRow) return { indexed: 0, embeddingTokens: 0 };

  const chunkRows = await getDb()
    .select()
    .from(chunks)
    .where(and(eq(chunks.sourceId, input.id), eq(chunks.userId, input.userId)))
    .orderBy(chunks.chunkIndex);

  if (chunkRows.length === 0) {
    await deleteStaleTail(input.id, 0);
    return { indexed: 0, embeddingTokens: 0 };
  }

  const embeddingInputs: string[] = chunkRows.map((c) => c.embeddingText ?? c.content);
  const estimatedTokens = embeddingInputs.reduce(
    (sum, text) => sum + estimateEmbeddingTokens(text),
    0,
  );

  let reservationId: string | null = null;
  if (estimatedTokens > 0) {
    try {
      const reservation = await reserveTokens(input.userId, {
        kind: 'EMBEDDING',
        estimatedTokens,

        ttlSeconds: 15 * 60,
      });
      reservationId = reservation.reservationId;
    } catch (err) {
      if (isAppError(err) && err.code === 'TOKEN_QUOTA_EXCEEDED') {
        throwIngestionError(
          'TOKEN_QUOTA_EXCEEDED',
          'Not enough embedding tokens remaining on your plan to index this source.',
          { cause: err },
        );
      }
      throw err;
    }
  }

  const batches = packEmbeddingBatches(embeddingInputs);
  const denseVectors: number[][] = Array.from({ length: embeddingInputs.length }, () => []);
  let actualTokens = 0;
  let cursor = 0;
  try {
    for (const batch of batches) {
      const { vectors, usageTokens } = await withSpan('embedding', () => embedBatch(batch), {
        'embedding.batch_size': batch.length,
        'app.source_id': input.id,
      });
      actualTokens += usageTokens;
      for (const vector of vectors) {
        denseVectors[cursor] = vector;
        cursor += 1;
      }
    }
  } catch (err) {
    if (reservationId) {
      await releaseReservation(reservationId).catch((releaseErr) => {
        logger.warn(
          { event: 'indexing.reservation.release_failed', reservationId, err: releaseErr },
          'Failed to release embedding reservation after embedding failure',
        );
      });
    }
    throw err;
  }

  const sparseVectors = embeddingInputs.map((text) => sparseEncoder.encodeDocument(text));

  const previousChunkCount = sourceRow.chunkCount;
  const newChunkCount = chunkRows.length;
  const dfDelta = new Map<bigint, number>();
  for (const chunkRow of chunkRows) {
    const text = chunkRow.embeddingText ?? chunkRow.content;
    const terms = sparseEncoder.countTerms(text);
    for (const t of terms) {
      dfDelta.set(t.termHash, (dfDelta.get(t.termHash) ?? 0) + 1);
    }
  }

  const now = new Date().toISOString();
  const points: DensePointInput[] = chunkRows.map((row, i) => {
    const payload: ChunkPayload = {
      user_id: row.userId,
      workspace_id: row.workspaceId,
      source_id: row.sourceId,
      source_type: sourceRow.type,
      chunk_index: row.chunkIndex,
      locator_kind: row.locatorKind ?? 'unknown',
      created_at: row.createdAt?.toISOString() ?? now,
    };
    return {
      id: row.id,
      dense: denseVectors[i] ?? [],
      sparse: sparseVectors[i] ?? { indices: [], values: [] },
      payload,
    };
  });

  await upsertPoints(points);
  await deleteStaleTail(input.id, newChunkCount);

  await withTransaction(async (tx) => {
    await bumpDocFrequencies(dfDelta, tx);
    await bumpTotalDocs(newChunkCount - previousChunkCount, tx);

    for (const chunkRow of chunkRows) {
      const text = chunkRow.embeddingText ?? chunkRow.content;
      const tokens = sparseEncoder.countTerms(text).reduce((n, t) => n + t.count, 0);
      await tx
        .update(chunks)
        .set({ docLength: BigInt(tokens) })
        .where(eq(chunks.id, chunkRow.id));
    }

    await tx
      .update(sources)
      .set({ updatedAt: sql`now()` })
      .where(eq(sources.id, input.id));
  });

  if (reservationId) {
    if (actualTokens > 0) {
      await commitReservation(reservationId, actualTokens);
    } else {
      await releaseReservation(reservationId);
    }
  }

  const firstPointId = points[0]?.id;
  if (firstPointId) {
    const exists = await verifyPointExists(firstPointId);
    if (!exists) {
      throwIngestionError(
        'INTERNAL_ERROR',
        `Qdrant did not return a just-upserted point (${firstPointId}) — write likely failed.`,
      );
    }
  }

  return { indexed: newChunkCount, embeddingTokens: actualTokens };
}
