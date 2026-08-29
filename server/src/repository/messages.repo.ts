import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import type { ChunkLocator, Citation, WebCitation } from '@/contract/index.js';
import { exec, type Executor, withTransaction } from '@/db/client.js';
import {
  chats,
  chunks,
  messageReferences,
  type MessageRow,
  messages,
  messageWebReferences,
  type NewMessageRow,
  sources,
} from '@/db/schema/index.js';
import { buildDeepLink } from '@/retrieval/hydrate.js';

export async function listMessagesForChat(
  userId: string,
  chatId: string,
  tx?: Executor,
): Promise<MessageRow[]> {
  return exec(tx)
    .select({
      id: messages.id,
      chatId: messages.chatId,
      userId: messages.userId,
      role: messages.role,
      content: messages.content,
      modelName: messages.modelName,
      promptTokens: messages.promptTokens,
      completionTokens: messages.completionTokens,
      consumedTokens: messages.consumedTokens,
      responseOfMessageId: messages.responseOfMessageId,
      reaction: messages.reaction,
      dislikedReason: messages.dislikedReason,
      dislikedNote: messages.dislikedNote,
      finishReason: messages.finishReason,
      metadata: messages.metadata,
      createdAt: messages.createdAt,
      updatedAt: messages.updatedAt,
    })
    .from(messages)
    .innerJoin(chats, eq(chats.id, messages.chatId))
    .where(and(eq(messages.chatId, chatId), eq(chats.userId, userId)))
    .orderBy(asc(messages.createdAt));
}

export async function insertMessage(row: NewMessageRow, tx?: Executor): Promise<MessageRow> {
  const [inserted] = await exec(tx).insert(messages).values(row).returning();
  if (!inserted) throw new Error('insertMessage: no row returned');
  return inserted;
}

export async function insertMessageWithReferences(
  row: NewMessageRow,
  refs: {
    chunks: Array<{ chunkId: string; citationIndex: number; score: string }>;
    webs: Array<{ citationIndex: number; url: string; title: string; snippet: string }>;
  },
): Promise<MessageRow> {
  return withTransaction(async (tx) => {
    const [inserted] = await tx.insert(messages).values(row).returning();
    if (!inserted) throw new Error('insertMessageWithReferences: no row returned');
    if (refs.chunks.length > 0) {
      await tx.insert(messageReferences).values(
        refs.chunks.map((c) => ({
          messageId: inserted.id,
          chunkId: c.chunkId,
          citationIndex: c.citationIndex,
          score: c.score,
        })),
      );
    }
    if (refs.webs.length > 0) {
      await tx.insert(messageWebReferences).values(
        refs.webs.map((w) => ({
          messageId: inserted.id,
          citationIndex: w.citationIndex,
          url: w.url,
          title: w.title,
          snippet: w.snippet,
        })),
      );
    }
    await tx
      .update(chats)
      .set({ messageCount: sql`${chats.messageCount} + 1`, updatedAt: sql`now()` })
      .where(eq(chats.id, row.chatId));
    return inserted;
  });
}

export async function countWebSearchesForChat(
  userId: string,
  chatId: string,
  tx?: Executor,
): Promise<number> {
  const [row] = await exec(tx)
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(chats, eq(chats.id, messages.chatId))
    .where(
      and(
        eq(messages.chatId, chatId),
        eq(chats.userId, userId),
        sql`${messages.metadata} -> 'webSearch' ->> 'used' = 'true'`,
      ),
    );
  return row?.n ?? 0;
}

export async function findMessageForUser(
  userId: string,
  messageId: string,
  tx?: Executor,
): Promise<MessageRow | null> {
  const rows = await exec(tx)
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function hydrateChunkCitations(
  userId: string,
  messageIds: readonly string[],
  tx?: Executor,
): Promise<Map<string, Citation[]>> {
  const out = new Map<string, Citation[]>();
  if (messageIds.length === 0) return out;

  const rows = await exec(tx)
    .select({
      messageId: messageReferences.messageId,
      citationIndex: messageReferences.citationIndex,
      score: messageReferences.score,
      chunkId: chunks.id,
      content: chunks.content,
      locator: chunks.locator,
      sourceId: chunks.sourceId,
      sourceTitle: sources.title,
      sourceType: sources.type,
      storagePublicId: sources.storagePublicId,
      sourceMetadata: sources.metadata,
      originalRef: sources.originalRef,
    })
    .from(messageReferences)
    .innerJoin(chunks, eq(chunks.id, messageReferences.chunkId))
    .innerJoin(sources, eq(sources.id, chunks.sourceId))
    .where(and(inArray(messageReferences.messageId, [...messageIds]), eq(chunks.userId, userId)));

  for (const r of rows) {
    const list = out.get(r.messageId) ?? [];
    const locator = r.locator as ChunkLocator;
    const citation: Citation = {
      index: r.citationIndex,
      chunkId: r.chunkId,
      sourceId: r.sourceId,
      sourceTitle: r.sourceTitle,
      sourceType: r.sourceType,
      locator,
      snippet: r.content.slice(0, 300),
      score: Number(r.score),
    };
    const deepLink = buildDeepLink(locator, {
      storagePublicId: r.storagePublicId,
      sourceMetadata: r.sourceMetadata as Record<string, unknown> | null,
      originalRef: r.originalRef,
    });
    if (deepLink) citation.deepLink = deepLink;
    list.push(citation);
    out.set(r.messageId, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.index - b.index);
  return out;
}

export async function hydrateWebCitations(
  messageIds: readonly string[],
  tx?: Executor,
): Promise<Map<string, WebCitation[]>> {
  const out = new Map<string, WebCitation[]>();
  if (messageIds.length === 0) return out;

  const rows = await exec(tx)
    .select({
      messageId: messageWebReferences.messageId,
      citationIndex: messageWebReferences.citationIndex,
      url: messageWebReferences.url,
      title: messageWebReferences.title,
      snippet: messageWebReferences.snippet,
    })
    .from(messageWebReferences)
    .where(inArray(messageWebReferences.messageId, [...messageIds]));

  for (const r of rows) {
    const list = out.get(r.messageId) ?? [];
    list.push({
      index: r.citationIndex,
      url: r.url,
      title: r.title,
      snippet: r.snippet,
    });
    out.set(r.messageId, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.index - b.index);
  return out;
}

export async function setMessageReactionForUser(
  userId: string,
  messageId: string,
  patch: Partial<Pick<MessageRow, 'reaction' | 'dislikedReason' | 'dislikedNote'>>,
  tx?: Executor,
): Promise<MessageRow | null> {
  const [updated] = await exec(tx)
    .update(messages)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(and(eq(messages.id, messageId), eq(messages.userId, userId)))
    .returning();
  return updated ?? null;
}
