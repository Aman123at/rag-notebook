import { QdrantClient } from '@qdrant/js-client-rest';

import { env } from '@/config/env.js';
import { EMBEDDING } from '@/contract/index.js';
import type { SparseVector } from '@/ingestion/sparse/encoder.js';
import { logger } from '@/observability/logger.js';
import { withSpan } from '@/observability/spans.js';

export const DENSE_VECTOR_NAME = 'dense';

export const SPARSE_VECTOR_NAME = 'bm25';

const PAYLOAD_INDEXES: ReadonlyArray<string> = [
  'user_id',
  'workspace_id',
  'source_id',
  'source_type',
];

export interface ChunkPayload {
  user_id: string;
  workspace_id: string;
  source_id: string;
  source_type: string;
  chunk_index: number;
  locator_kind: string;
  created_at: string;
}

export interface DensePointInput {
  id: string;
  dense: number[];
  sparse: SparseVector;
  payload: ChunkPayload;
}

let clientHandle: QdrantClient | undefined;
let bootstrapPromise: Promise<void> | undefined;

let bootstrapValidUntil = 0;

const BOOTSTRAP_TTL_MS = 30_000;

const REQUEST_TIMEOUT_MS = 30_000;

function getClient(): QdrantClient {
  if (clientHandle) return clientHandle;
  if (!env.QDRANT_URL) {
    throw new Error('QDRANT_URL is not configured but Qdrant client was requested.');
  }
  const params: ConstructorParameters<typeof QdrantClient>[0] = {
    url: env.QDRANT_URL,

    timeout: REQUEST_TIMEOUT_MS,

    checkCompatibility: false,
  };
  if (env.QDRANT_API_KEY) params.apiKey = env.QDRANT_API_KEY;
  clientHandle = new QdrantClient(params);
  return clientHandle;
}

export function resetQdrantClient(): void {
  clientHandle = undefined;
  bootstrapPromise = undefined;
  bootstrapValidUntil = 0;
}

export function invalidateQdrantBootstrap(): void {
  bootstrapPromise = undefined;
  bootstrapValidUntil = 0;
}

function isMissingCollectionError(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false;
  const record = err as { status?: number; message?: string };
  const msg = typeof record.message === 'string' ? record.message.toLowerCase() : '';
  if (msg.includes("doesn't exist") || msg.includes('does not exist')) return true;
  return record.status === 404 && msg.includes('collection');
}

export async function ensureQdrantCollection(): Promise<void> {
  if (bootstrapPromise && Date.now() < bootstrapValidUntil) return bootstrapPromise;
  const attempt = doBootstrap().then(
    () => {
      bootstrapValidUntil = Date.now() + BOOTSTRAP_TTL_MS;
    },
    (err: unknown) => {
      bootstrapPromise = undefined;
      bootstrapValidUntil = 0;
      throw err;
    },
  );
  bootstrapPromise = attempt;
  return attempt;
}

async function doBootstrap(): Promise<void> {
  const client = getClient();
  const collection = env.QDRANT_COLLECTION;

  const existence = await client.collectionExists(collection);
  if (!existence.exists) {
    logger.info({ event: 'qdrant.collection.create', collection }, 'Creating Qdrant collection');
    await client.createCollection(collection, {
      vectors: {
        [DENSE_VECTOR_NAME]: {
          size: EMBEDDING.EMBEDDING_DIMENSIONS,
          distance: 'Cosine',
          on_disk: true,
        },
      },
      sparse_vectors: {
        [SPARSE_VECTOR_NAME]: {
          index: { on_disk: true },
        },
      },
    });
  }

  for (const field of PAYLOAD_INDEXES) {
    try {
      await client.createPayloadIndex(collection, {
        field_name: field,
        field_schema: 'keyword',
        wait: true,
      });
    } catch (err) {
      if (isAlreadyExistsError(err)) continue;
      throw err;
    }
  }
}

function isAlreadyExistsError(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false;
  const record = err as { status?: number; message?: string };
  if (record.status === 409) return true;
  const msg = typeof record.message === 'string' ? record.message.toLowerCase() : '';
  return msg.includes('already exists');
}

export async function upsertPoints(points: readonly DensePointInput[]): Promise<void> {
  if (points.length === 0) return;
  await withSpan(
    'qdrant.upsert',
    async () => {
      const body = {
        wait: true as const,
        points: points.map((p) => ({
          id: p.id,
          vector: {
            [DENSE_VECTOR_NAME]: p.dense,
            [SPARSE_VECTOR_NAME]: { indices: p.sparse.indices, values: p.sparse.values },
          },
          payload: { ...p.payload },
        })),
      };
      await ensureQdrantCollection();
      try {
        await getClient().upsert(env.QDRANT_COLLECTION, body);
      } catch (err) {
        if (!isMissingCollectionError(err)) throw err;
        logger.warn(
          { event: 'qdrant.collection.missing', collection: env.QDRANT_COLLECTION },
          'Qdrant collection missing on write — re-bootstrapping and retrying once',
        );
        invalidateQdrantBootstrap();
        await ensureQdrantCollection();
        await getClient().upsert(env.QDRANT_COLLECTION, body);
      }
    },
    { 'qdrant.points': points.length, 'qdrant.collection': env.QDRANT_COLLECTION },
  );
}

export async function verifyPointExists(pointId: string): Promise<boolean> {
  const client = getClient();
  const rows = await client.retrieve(env.QDRANT_COLLECTION, {
    ids: [pointId],
    with_payload: false,
    with_vector: false,
  });
  return rows.length > 0;
}

export async function deleteBySourceId(sourceId: string): Promise<void> {
  await deleteByFilter({
    must: [{ key: 'source_id', match: { value: sourceId } }],
  });
}

export async function deleteByWorkspaceId(workspaceId: string): Promise<void> {
  await deleteByFilter({
    must: [{ key: 'workspace_id', match: { value: workspaceId } }],
  });
}

export async function deleteByUserId(userId: string): Promise<void> {
  await deleteByFilter({
    must: [{ key: 'user_id', match: { value: userId } }],
  });
}

export async function deleteStaleTail(sourceId: string, keepBelow: number): Promise<void> {
  await deleteByFilter({
    must: [
      { key: 'source_id', match: { value: sourceId } },
      { key: 'chunk_index', range: { gte: keepBelow } },
    ],
  });
}

async function deleteByFilter(filter: Record<string, unknown>): Promise<void> {
  await ensureQdrantCollection();
  const client = getClient();
  await client.delete(env.QDRANT_COLLECTION, { wait: true, filter });
}

export interface QdrantHybridInput {
  userId: string;
  workspaceId: string;
  denseVector: number[];
  sparseVector: SparseVector;
  denseTopK: number;
  sparseTopK: number;
  finalTopK: number;
}

export interface QdrantScoredPoint {
  id: string | number;
  score: number;
}

export interface QdrantHybridOutput {
  points: QdrantScoredPoint[];

  denseHits: number;
  sparseHits: number;
}

export async function qdrantHybridQuery(input: QdrantHybridInput): Promise<QdrantHybridOutput> {
  return withSpan('qdrant.query', () => qdrantHybridQueryInner(input), {
    'app.user_id': input.userId,
    'app.workspace_id': input.workspaceId,
    'qdrant.collection': env.QDRANT_COLLECTION,
    'qdrant.dense_top_k': input.denseTopK,
    'qdrant.sparse_top_k': input.sparseTopK,
    'qdrant.final_top_k': input.finalTopK,
  });
}

async function qdrantHybridQueryInner(input: QdrantHybridInput): Promise<QdrantHybridOutput> {
  await ensureQdrantCollection();
  const client = getClient();

  const filter = {
    must: [
      { key: 'user_id', match: { value: input.userId } },
      { key: 'workspace_id', match: { value: input.workspaceId } },
    ],
  };

  const response = await client.query(env.QDRANT_COLLECTION, {
    prefetch: [
      {
        query: input.denseVector,
        using: DENSE_VECTOR_NAME,
        limit: input.denseTopK,
        filter,
      },
      {
        query: {
          indices: input.sparseVector.indices,
          values: input.sparseVector.values,
        },
        using: SPARSE_VECTOR_NAME,
        limit: input.sparseTopK,
        filter,
      },
    ],
    query: { fusion: 'rrf' },
    limit: input.finalTopK,
    with_payload: false,
    with_vector: false,
    filter,
  });

  return {
    points: response.points.map((p) => ({ id: p.id, score: p.score })),
    denseHits: input.denseTopK,
    sparseHits: input.sparseTopK,
  };
}

export async function checkQdrant(): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string | null;
}> {
  const startedAt = Date.now();
  try {
    if (!env.QDRANT_URL) {
      return { ok: false, latencyMs: 0, message: 'QDRANT_URL not configured' };
    }
    const client = getClient();
    await client.collectionExists(env.QDRANT_COLLECTION);
    return { ok: true, latencyMs: Date.now() - startedAt, message: null };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
