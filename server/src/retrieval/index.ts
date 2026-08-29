import type { Span } from '@opentelemetry/api';

import { RETRIEVAL } from '@/contract/index.js';
import { logger } from '@/observability/logger.js';
import { withSpan } from '@/observability/spans.js';

import { runHybridQuery } from './hybrid.js';
import { assembleRetrievedChunks, fetchHydrationRows } from './hydrate.js';
import type { RetrieveInput, RetrieveResult } from './types.js';

const POOL_MULTIPLIER = 4;

function fusionPoolSize(finalTopK: number): number {
  return Math.min(RETRIEVAL.denseTopK, Math.max(finalTopK, finalTopK * POOL_MULTIPLIER));
}

export async function retrieve(input: RetrieveInput): Promise<RetrieveResult> {
  return withSpan('retrieval.total', (span) => retrieveInner(input, span), {
    'app.user_id': input.userId,
    'app.workspace_id': input.workspaceId,
    'retrieval.top_k': input.topK ?? RETRIEVAL.finalTopK,
  });
}

async function retrieveInner(input: RetrieveInput, span: Span): Promise<RetrieveResult> {
  const startedAt = Date.now();
  const finalTopK = input.topK ?? RETRIEVAL.finalTopK;
  const { fused, denseHits, sparseHits } = await runHybridQuery({
    userId: input.userId,
    workspaceId: input.workspaceId,
    query: input.query,
    finalTopK: fusionPoolSize(finalTopK),
  });

  if (fused.length === 0) {
    return {
      chunks: [],
      meta: {
        denseHits,
        sparseHits,
        fusedHits: 0,
        distinctSources: 0,
        latencyMs: Date.now() - startedAt,
      },
    };
  }

  const hydrated = await fetchHydrationRows(
    input.userId,
    input.workspaceId,
    fused.map((f) => f.chunkId),
  );

  const chunks = assembleRetrievedChunks(fused, hydrated, finalTopK);
  const distinctSources = new Set(chunks.map((c) => c.sourceId)).size;
  const latencyMs = Date.now() - startedAt;

  logger.info(
    {
      event: 'retrieval.retrieve',
      userId: input.userId,
      workspaceId: input.workspaceId,
      denseHits,
      sparseHits,
      fusedHits: fused.length,
      returned: chunks.length,
      distinctSources,
      latencyMs,
    },
    'retrieve() complete',
  );

  span.setAttributes({
    'retrieval.dense_hits': denseHits,
    'retrieval.sparse_hits': sparseHits,
    'retrieval.fused_hits': fused.length,
    'retrieval.returned': chunks.length,
    'retrieval.distinct_sources': distinctSources,
    'retrieval.latency_ms': latencyMs,
  });

  return {
    chunks,
    meta: {
      denseHits,
      sparseHits,
      fusedHits: fused.length,
      distinctSources,
      latencyMs,
    },
  };
}

export { buildDeepLink } from './hydrate.js';
export { assemblePrompt, formatLocator } from './prompt.js';
export type {
  AssembledPrompt,
  PromptExtras,
  PromptOptions,
  RetrievedChunk,
  RetrieveInput,
  RetrieveResult,
  WebSearchMode,
} from './types.js';
