import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { exec, type Executor } from '@/db/client.js';
import { type ChatRow, chats, type NewChatRow } from '@/db/schema/index.js';

export async function listChatsForWorkspace(
  userId: string,
  workspaceId: string,
  tx?: Executor,
): Promise<ChatRow[]> {
  return exec(tx)
    .select()
    .from(chats)
    .where(
      and(eq(chats.userId, userId), eq(chats.workspaceId, workspaceId), isNull(chats.deletedAt)),
    )
    .orderBy(desc(chats.createdAt));
}

export async function listChatsForWorkspacePaged(
  userId: string,
  workspaceId: string,
  window: { limit: number; offset: number },
  tx?: Executor,
): Promise<{ rows: ChatRow[]; total: number }> {
  const db = exec(tx);
  const where = and(
    eq(chats.userId, userId),
    eq(chats.workspaceId, workspaceId),
    isNull(chats.deletedAt),
  );
  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(chats)
      .where(where)
      .orderBy(desc(chats.createdAt))
      .limit(window.limit)
      .offset(window.offset),
    db
      .select({ total: sql<string>`count(*)::text` })
      .from(chats)
      .where(where),
  ]);
  const totalStr = countRows[0]?.total ?? '0';
  return { rows, total: Number(totalStr) };
}

export async function findChatForUser(
  userId: string,
  chatId: string,
  tx?: Executor,
): Promise<ChatRow | null> {
  const rows = await exec(tx)
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId), isNull(chats.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findActiveChatForWorkspace(
  userId: string,
  workspaceId: string,
  tx?: Executor,
): Promise<ChatRow | null> {
  const rows = await exec(tx)
    .select()
    .from(chats)
    .where(
      and(eq(chats.userId, userId), eq(chats.workspaceId, workspaceId), isNull(chats.deletedAt)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function insertChat(row: NewChatRow, tx?: Executor): Promise<ChatRow> {
  const [inserted] = await exec(tx).insert(chats).values(row).returning();
  if (!inserted) throw new Error('insertChat: no row returned');
  return inserted;
}

export async function updateChatForUser(
  userId: string,
  chatId: string,
  patch: Partial<Pick<ChatRow, 'title' | 'isArchived' | 'isPublic' | 'publicSlug' | 'summary'>>,
  tx?: Executor,
): Promise<ChatRow | null> {
  const [updated] = await exec(tx)
    .update(chats)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId), isNull(chats.deletedAt)))
    .returning();
  return updated ?? null;
}

export async function softDeleteChatForUser(
  userId: string,
  chatId: string,
  tx?: Executor,
): Promise<ChatRow | null> {
  const [deleted] = await exec(tx)
    .update(chats)
    .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId), isNull(chats.deletedAt)))
    .returning();
  return deleted ?? null;
}
