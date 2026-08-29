import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { exec, type Executor } from '@/db/client.js';
import { type NewWorkspaceRow, type WorkspaceRow, workspaces } from '@/db/schema/index.js';

export async function listWorkspacesForUser(
  userId: string,
  tx?: Executor,
): Promise<WorkspaceRow[]> {
  return exec(tx)
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.userId, userId), isNull(workspaces.deletedAt)))
    .orderBy(desc(workspaces.createdAt));
}

export async function findWorkspaceForUser(
  userId: string,
  workspaceId: string,
  tx?: Executor,
): Promise<WorkspaceRow | null> {
  const rows = await exec(tx)
    .select()
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.userId, userId),
        isNull(workspaces.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function insertWorkspace(row: NewWorkspaceRow, tx?: Executor): Promise<WorkspaceRow> {
  const [inserted] = await exec(tx).insert(workspaces).values(row).returning();
  if (!inserted) throw new Error('insertWorkspace: no row returned');
  return inserted;
}

export async function updateWorkspaceForUser(
  userId: string,
  workspaceId: string,
  patch: { name?: string; description?: string | null },
  tx?: Executor,
): Promise<WorkspaceRow | null> {
  const [updated] = await exec(tx)
    .update(workspaces)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(
      and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.userId, userId),
        isNull(workspaces.deletedAt),
      ),
    )
    .returning();
  return updated ?? null;
}

export async function softDeleteWorkspaceForUser(
  userId: string,
  workspaceId: string,
  tx?: Executor,
): Promise<WorkspaceRow | null> {
  const [deleted] = await exec(tx)
    .update(workspaces)
    .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
    .where(
      and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.userId, userId),
        isNull(workspaces.deletedAt),
      ),
    )
    .returning();
  return deleted ?? null;
}

export async function listWorkspacesForUserPaged(
  userId: string,
  window: { limit: number; offset: number },
  tx?: Executor,
): Promise<{ rows: WorkspaceRow[]; total: number }> {
  const db = exec(tx);
  const where = and(eq(workspaces.userId, userId), isNull(workspaces.deletedAt));
  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(workspaces)
      .where(where)
      .orderBy(desc(workspaces.createdAt))
      .limit(window.limit)
      .offset(window.offset),
    db
      .select({ total: sql<string>`count(*)::text` })
      .from(workspaces)
      .where(where),
  ]);
  const totalStr = countRows[0]?.total ?? '0';
  return { rows, total: Number(totalStr) };
}

export async function softDeleteChatsForWorkspace(
  userId: string,
  workspaceId: string,
  tx: Executor,
): Promise<void> {
  const { chats } = await import('@/db/schema/index.js');
  await tx
    .update(chats)
    .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
    .where(
      and(eq(chats.userId, userId), eq(chats.workspaceId, workspaceId), isNull(chats.deletedAt)),
    );
}

export async function adjustSourceCount(
  workspaceId: string,
  delta: number,
  tx?: Executor,
): Promise<void> {
  await exec(tx)
    .update(workspaces)
    .set({
      sourceCount: sql`${workspaces.sourceCount} + ${delta}`,
      updatedAt: sql`now()`,
    })
    .where(eq(workspaces.id, workspaceId));
}
