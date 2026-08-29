import { and, desc, eq, sql } from 'drizzle-orm';

import { exec, type Executor } from '@/db/client.js';
import { type ArtifactRow, artifacts } from '@/db/schema/index.js';

type NewArtifactRow = typeof artifacts.$inferInsert;

export async function listArtifactsForSource(
  userId: string,
  sourceId: string,
  tx?: Executor,
): Promise<ArtifactRow[]> {
  return exec(tx)
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.userId, userId), eq(artifacts.sourceId, sourceId)))
    .orderBy(desc(artifacts.createdAt));
}

export async function findArtifactForUser(
  userId: string,
  artifactId: string,
  tx?: Executor,
): Promise<ArtifactRow | null> {
  const rows = await exec(tx)
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.id, artifactId), eq(artifacts.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findArtifactById(
  artifactId: string,
  tx?: Executor,
): Promise<ArtifactRow | null> {
  const rows = await exec(tx).select().from(artifacts).where(eq(artifacts.id, artifactId)).limit(1);
  return rows[0] ?? null;
}

export async function findLatestArtifactByKind(
  sourceId: string,
  kind: string,
  tx?: Executor,
): Promise<ArtifactRow | null> {
  const rows = await exec(tx)
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.sourceId, sourceId), eq(artifacts.type, kind)))
    .orderBy(desc(artifacts.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertArtifact(row: NewArtifactRow, tx?: Executor): Promise<ArtifactRow> {
  const [inserted] = await exec(tx).insert(artifacts).values(row).returning();
  if (!inserted) throw new Error('insertArtifact: no row returned');
  return inserted;
}

export async function updateArtifact(
  artifactId: string,
  patch: Partial<Pick<ArtifactRow, 'status' | 'content' | 'modelName' | 'consumedTokens'>>,
  tx?: Executor,
): Promise<ArtifactRow | null> {
  const [updated] = await exec(tx)
    .update(artifacts)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(eq(artifacts.id, artifactId))
    .returning();
  return updated ?? null;
}
