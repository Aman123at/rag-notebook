import { RETRIEVAL } from '@/contract/index.js';
import { sparseEncoder, type SparseVector } from '@/ingestion/sparse/encoder.js';
import { embedBatch } from '@/integrations/openai.js';
import { qdrantHybridQuery } from '@/integrations/qdrant.js';
import { logger } from '@/observability/logger.js';
import { withSpan } from '@/observability/spans.js';
import { findDocFrequencies, readTotalDocs } from '@/repository/lexical.repo.js';

export interface HybridFused {
  chunkId: string;

  fusedScore: number;

  rank: number;
}

export interface HybridQueryInput {
  userId: string;
  workspaceId: string;
  query: string;

  finalTopK?: number;
}

export interface HybridQueryOutput {
  fused: HybridFused[];

  denseHits: number;
  sparseHits: number;
}

export async function runHybridQuery(input: HybridQueryInput): Promise<HybridQueryOutput> {
  const { userId, workspaceId, query } = input;
  const finalTopK = input.finalTopK ?? RETRIEVAL.finalTopK;

  const [dense, sparse] = await Promise.all([embedQueryDense(query), encodeQuerySparse(query)]);

  const response = await qdrantHybridQuery({
    userId,
    workspaceId,
    denseVector: dense,
    sparseVector: sparse,
    denseTopK: RETRIEVAL.denseTopK,
    sparseTopK: RETRIEVAL.sparseTopK,
    finalTopK,
  });

  const fused: HybridFused[] = response.points.map((p, i) => ({
    chunkId: String(p.id),
    fusedScore: p.score,
    rank: i + 1,
  }));

  logger.debug(
    {
      event: 'retrieval.hybrid',
      userId,
      workspaceId,
      denseHits: response.denseHits,
      sparseHits: response.sparseHits,
      fusedHits: fused.length,
    },
    'Hybrid query complete',
  );

  return { fused, denseHits: response.denseHits, sparseHits: response.sparseHits };
}

async function embedQueryDense(query: string): Promise<number[]> {
  const { vectors } = await withSpan('embedding', () => embedBatch([query]), {
    'embedding.kind': 'query',
  });
  const first = vectors[0];
  if (!first) {
    throw new Error('OpenAI returned no embedding for the query.');
  }
  return first;
}

async function encodeQuerySparse(query: string): Promise<SparseVector> {
  const terms = sparseEncoder.countTerms(query);
  if (terms.length === 0) return { indices: [], values: [] };
  const termHashes = terms.map((t) => t.termHash);
  const [dfByHash, totalDocs] = await Promise.all([
    findDocFrequencies(termHashes),
    readTotalDocs(),
  ]);
  return sparseEncoder.encodeQuery(query, dfByHash, totalDocs);
}
