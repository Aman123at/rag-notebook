import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm';

import { chunkId } from '@/db/chunk-id.js';
import { exec, type Executor, withTransaction } from '@/db/client.js';
import { type ChunkRow, chunks, type NewChunkRow } from '@/db/schema/index.js';

export async function insertChunksForSource(
  sourceId: string,
  rows: Array<Omit<NewChunkRow, 'id' | 'chunkIndex'> & { chunkIndex: number }>,
): Promise<ChunkRow[]> {
  if (rows.length === 0) return [];
  const withIds: NewChunkRow[] = rows.map((r) => ({
    ...r,
    id: chunkId(sourceId, r.chunkIndex),
  }));
  return withTransaction(async (tx) => {
    const inserted = await tx
      .insert(chunks)
      .values(withIds)
      .onConflictDoNothing({ target: chunks.id })
      .returning();
    return inserted;
  });
}

export async function upsertChunksForSource(
  sourceId: string,
  rows: Array<Omit<NewChunkRow, 'id' | 'chunkIndex'> & { chunkIndex: number }>,
): Promise<ChunkRow[]> {
  if (rows.length === 0) return [];
  const withIds: NewChunkRow[] = rows.map((r) => ({
    ...r,
    id: chunkId(sourceId, r.chunkIndex),
  }));
  return withTransaction(async (tx) => {
    return tx
      .insert(chunks)
      .values(withIds)
      .onConflictDoUpdate({
        target: chunks.id,
        set: {
          content: sql`excluded.content`,
          embeddingText: sql`excluded.embedding_text`,
          tokenCount: sql`excluded.token_count`,
          locator: sql`excluded.locator`,
          metadata: sql`excluded.metadata`,
        },
      })
      .returning();
  });
}

export async function deleteChunksAtOrAbove(
  sourceId: string,
  keepBelow: number,
  tx?: Executor,
): Promise<number> {
  const result = await exec(tx)
    .delete(chunks)
    .where(and(eq(chunks.sourceId, sourceId), gte(chunks.chunkIndex, keepBelow)))
    .returning({ id: chunks.id });
  return result.length;
}

export async function findChunksForSource(
  userId: string,
  workspaceId: string,
  sourceId: string,
  tx?: Executor,
): Promise<ChunkRow[]> {
  return exec(tx)
    .select()
    .from(chunks)
    .where(
      and(
        eq(chunks.userId, userId),
        eq(chunks.workspaceId, workspaceId),
        eq(chunks.sourceId, sourceId),
      ),
    )
    .orderBy(asc(chunks.chunkIndex));
}

export async function findChunkByIdForUser(
  userId: string,
  sourceId: string,
  chunkIdParam: string,
  tx?: Executor,
): Promise<ChunkRow | null> {
  const rows = await exec(tx)
    .select()
    .from(chunks)
    .where(
      and(eq(chunks.id, chunkIdParam), eq(chunks.userId, userId), eq(chunks.sourceId, sourceId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function findChunksByIdsForTenant(
  userId: string,
  workspaceId: string,
  chunkIds: readonly string[],
  tx?: Executor,
): Promise<ChunkRow[]> {
  if (chunkIds.length === 0) return [];
  return exec(tx)
    .select()
    .from(chunks)
    .where(
      and(
        eq(chunks.userId, userId),
        eq(chunks.workspaceId, workspaceId),
        inArray(chunks.id, [...chunkIds]),
      ),
    );
}
