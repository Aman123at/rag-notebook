import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';

import { exec, type Executor, getDb, withTransaction } from '@/db/client.js';
import { type NewSourceRow, type SourceRow, sources } from '@/db/schema/index.js';

import { adjustSourceCount } from './workspaces.repo.js';

export async function listSourcesForWorkspace(
  userId: string,
  workspaceId: string,
  tx?: Executor,
): Promise<SourceRow[]> {
  return exec(tx)
    .select()
    .from(sources)
    .where(
      and(
        eq(sources.userId, userId),
        eq(sources.workspaceId, workspaceId),
        isNull(sources.deletedAt),
      ),
    )
    .orderBy(desc(sources.createdAt));
}

export async function findSourceForUser(
  userId: string,
  sourceId: string,
  workspaceId?: string,
  tx?: Executor,
): Promise<SourceRow | null> {
  const clauses = [eq(sources.id, sourceId), eq(sources.userId, userId), isNull(sources.deletedAt)];
  if (workspaceId !== undefined) clauses.push(eq(sources.workspaceId, workspaceId));
  const rows = await exec(tx)
    .select()
    .from(sources)
    .where(and(...clauses))
    .limit(1);
  return rows[0] ?? null;
}

export async function listChildSourcesForParent(
  userId: string,
  parentSourceId: string,
  tx?: Executor,
): Promise<SourceRow[]> {
  return exec(tx)
    .select()
    .from(sources)
    .where(
      and(
        eq(sources.userId, userId),
        eq(sources.parentSourceId, parentSourceId),
        isNull(sources.deletedAt),
      ),
    )
    .orderBy(asc(sources.createdAt));
}

export async function findSourceById(sourceId: string, tx?: Executor): Promise<SourceRow | null> {
  const rows = await exec(tx)
    .select()
    .from(sources)
    .where(and(eq(sources.id, sourceId), isNull(sources.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertSourceAndBumpCounter(row: NewSourceRow): Promise<SourceRow> {
  return withTransaction(async (tx) => {
    const [inserted] = await tx.insert(sources).values(row).returning();
    if (!inserted) throw new Error('insertSourceAndBumpCounter: no row returned');
    await adjustSourceCount(row.workspaceId, +1, tx);
    return inserted;
  });
}

export async function insertChildSource(row: NewSourceRow): Promise<SourceRow> {
  const [inserted] = await getDb().insert(sources).values(row).returning();
  if (!inserted) throw new Error('insertChildSource: no row returned');
  return inserted;
}

export async function softDeletePlaylistChildren(
  userId: string,
  parentSourceId: string,
  tx?: Executor,
): Promise<string[]> {
  const deleted = await exec(tx)
    .update(sources)
    .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
    .where(
      and(
        eq(sources.parentSourceId, parentSourceId),
        eq(sources.userId, userId),
        isNull(sources.deletedAt),
      ),
    )
    .returning({ id: sources.id });
  return deleted.map((r) => r.id);
}

export async function updateSourceExtractionResult(
  sourceId: string,
  patch: { title: string; metadata?: Record<string, unknown>; contentHash?: string },
  tx?: Executor,
): Promise<SourceRow | null> {
  const set: Partial<Pick<SourceRow, 'metadata' | 'contentHash'>> & {
    updatedAt: ReturnType<typeof sql>;
  } = {
    updatedAt: sql`now()`,
  };
  if (patch.metadata !== undefined) set.metadata = patch.metadata;
  if (patch.contentHash !== undefined) set.contentHash = patch.contentHash;
  const [updated] = await exec(tx)
    .update(sources)
    .set({ ...set, title: patch.title })
    .where(
      and(
        eq(sources.id, sourceId),

        eq(sources.title, sources.originalRef),
      ),
    )
    .returning();
  if (updated) return updated;

  if (patch.metadata === undefined && patch.contentHash === undefined) return null;
  const [meta] = await exec(tx)
    .update(sources)
    .set(set)
    .where(eq(sources.id, sourceId))
    .returning();
  return meta ?? null;
}

export async function recomputeParentChunkCount(
  parentSourceId: string,
  tx?: Executor,
): Promise<number | null> {
  const [updated] = await exec(tx)
    .update(sources)
    .set({
      chunkCount: sql`coalesce((select sum(child.chunk_count)::int from sources as child
        where child.parent_source_id = ${parentSourceId} and child.deleted_at is null), 0)`,
      updatedAt: sql`now()`,
    })
    .where(eq(sources.id, parentSourceId))
    .returning({ chunkCount: sources.chunkCount });
  return updated?.chunkCount ?? null;
}

export async function updateSourceStatus(
  sourceId: string,
  patch: Partial<
    Pick<SourceRow, 'status' | 'failureCode' | 'failureMessage' | 'failureRetryable' | 'chunkCount'>
  >,
  tx?: Executor,
): Promise<SourceRow | null> {
  const [updated] = await exec(tx)
    .update(sources)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(eq(sources.id, sourceId))
    .returning();
  return updated ?? null;
}

export async function softDeleteSourcesForWorkspace(
  userId: string,
  workspaceId: string,
  tx: Executor,
): Promise<SourceRow[]> {
  const deleted = await tx
    .update(sources)
    .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
    .where(
      and(
        eq(sources.userId, userId),
        eq(sources.workspaceId, workspaceId),
        isNull(sources.deletedAt),
      ),
    )
    .returning();
  if (deleted.length > 0) {
    const { workspaces } = await import('@/db/schema/index.js');
    await tx
      .update(workspaces)
      .set({ sourceCount: 0, updatedAt: sql`now()` })
      .where(eq(workspaces.id, workspaceId));
  }
  return deleted;
}

export async function listStoragePublicIdsForWorkspace(
  workspaceId: string,
  tx?: Executor,
): Promise<string[]> {
  const rows = await exec(tx)
    .select({ publicId: sources.storagePublicId })
    .from(sources)
    .where(eq(sources.workspaceId, workspaceId));
  const out: string[] = [];
  for (const r of rows) if (r.publicId) out.push(r.publicId);
  return out;
}

export async function softDeleteSourceForUser(
  userId: string,
  sourceId: string,
): Promise<SourceRow | null> {
  return withTransaction(async (tx) => {
    const [deleted] = await tx
      .update(sources)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(sources.id, sourceId), eq(sources.userId, userId), isNull(sources.deletedAt)))
      .returning();
    if (!deleted) return null;
    if (deleted.parentSourceId === null) {
      await adjustSourceCount(deleted.workspaceId, -1, tx);
    }
    return deleted;
  });
}
