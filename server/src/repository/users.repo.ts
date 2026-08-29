import { eq, sql } from 'drizzle-orm';

import { exec, type Executor } from '@/db/client.js';
import { type NewUserRow, type UserRow, users } from '@/db/schema/index.js';

export async function findUserById(id: string, tx?: Executor): Promise<UserRow | null> {
  const rows = await exec(tx).select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function findUserByClerkId(
  clerkUserId: string,
  tx?: Executor,
): Promise<UserRow | null> {
  const rows = await exec(tx)
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertUser(row: NewUserRow, tx?: Executor): Promise<UserRow> {
  const [inserted] = await exec(tx).insert(users).values(row).returning();
  if (!inserted) throw new Error('insertUser: no row returned');
  return inserted;
}

export async function upsertUserByClerkId(
  row: NewUserRow & { clerkUserId: string },
  tx?: Executor,
): Promise<UserRow> {
  const [saved] = await exec(tx)
    .insert(users)
    .values(row)
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        email: row.email,
        displayName: row.displayName ?? null,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  if (!saved) throw new Error('upsertUserByClerkId: no row returned');
  return saved;
}

export async function insertUserIfNotExists(
  row: NewUserRow & { clerkUserId: string },
  tx?: Executor,
): Promise<UserRow> {
  const inserted = await exec(tx).insert(users).values(row).onConflictDoNothing().returning();
  const first = inserted[0];
  if (first) return first;
  const existing = await findUserByClerkId(row.clerkUserId, tx);
  if (!existing) throw new Error('insertUserIfNotExists: row missing after conflict');
  return existing;
}

export async function updateUserByClerkId(
  clerkUserId: string,
  patch: { email?: string; displayName?: string | null },
  tx?: Executor,
): Promise<UserRow | null> {
  const [updated] = await exec(tx)
    .update(users)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(eq(users.clerkUserId, clerkUserId))
    .returning();
  return updated ?? null;
}

export async function updateUserProfile(
  userId: string,
  patch: { displayName?: string | null },
  tx?: Executor,
): Promise<UserRow | null> {
  const [updated] = await exec(tx)
    .update(users)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(eq(users.id, userId))
    .returning();
  return updated ?? null;
}

export async function anonymiseUserByClerkId(
  clerkUserId: string,
  tx?: Executor,
): Promise<UserRow | null> {
  const [updated] = await exec(tx)
    .update(users)
    .set({
      clerkUserId: sql`concat('deleted:', ${users.id}::text)`,
      email: sql`concat('deleted+', ${users.id}::text, '@anon.local')`,
      displayName: null,
      isActive: false,
      isBlocked: true,
      blockedAt: sql`now()`,
      blockedReason: 'clerk.user.deleted',
      updatedAt: sql`now()`,
    })
    .where(eq(users.clerkUserId, clerkUserId))
    .returning();
  return updated ?? null;
}

export async function countWorkspacesForUser(userId: string, tx?: Executor): Promise<number> {
  const rows = (await exec(tx).execute(
    sql`select count(*)::text as count from workspaces where user_id = ${userId} and deleted_at is null`,
  )) as ReadonlyArray<{ count: string }>;
  const first = rows[0];
  return first ? Number(first.count) : 0;
}

export async function addTokenUsage(
  userId: string,
  delta: { embedding?: bigint; completion?: bigint },
  tx?: Executor,
): Promise<void> {
  const emb = delta.embedding ?? 0n;
  const comp = delta.completion ?? 0n;
  if (emb === 0n && comp === 0n) return;
  await exec(tx)
    .update(users)
    .set({
      usedTokensEmbedding: sql`${users.usedTokensEmbedding} + ${emb}`,
      usedTokensCompletion: sql`${users.usedTokensCompletion} + ${comp}`,
      updatedAt: sql`now()`,
    })
    .where(eq(users.id, userId));
}

export async function lockUserRowForBudget(userId: string, tx: Executor): Promise<UserRow | null> {
  const rows = await tx.select().from(users).where(eq(users.id, userId)).for('update').limit(1);
  return rows[0] ?? null;
}

export async function incrementAssignedTokens(
  userId: string,
  delta: bigint,
  tx?: Executor,
): Promise<void> {
  if (delta === 0n) return;
  await exec(tx)
    .update(users)
    .set({
      assignedTokens: sql`coalesce(${users.assignedTokens}, 0::bigint) + ${delta}`,
      updatedAt: sql`now()`,
    })
    .where(eq(users.id, userId));
}
