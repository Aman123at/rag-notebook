import {
  type Chat,
  type Citation,
  type DislikedReason,
  type Message,
  type WebCitation,
} from '@/contract/index.js';
import { type ChatRow, type MessageRow } from '@/db/schema/index.js';
import { AppError } from '@/errors/AppError.js';
import {
  findActiveChatForWorkspace,
  findChatForUser,
  insertChat,
  listChatsForWorkspacePaged,
  softDeleteChatForUser,
  updateChatForUser,
} from '@/repository/chats.repo.js';
import {
  findMessageForUser,
  hydrateChunkCitations,
  hydrateWebCitations,
  listMessagesForChat,
  setMessageReactionForUser,
} from '@/repository/messages.repo.js';
import { findWorkspaceForUser } from '@/repository/workspaces.repo.js';
import type { ListChatsResult } from '@/types/chats.types.js';

const DEFAULT_TITLE = 'New chat';

function toWire(row: ChatRow): Chat {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    summary: row.summary,
    summaryUpdatedAt: row.summaryUpdatedAt ? row.summaryUpdatedAt.toISOString() : null,
    messageCount: row.messageCount,
    isArchived: row.isArchived,
    isPublic: row.isPublic,
    publicSlug: row.publicSlug,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listChats(
  userId: string,
  workspaceId: string,
  window: { limit: number; offset: number },
): Promise<ListChatsResult> {
  await assertWorkspaceAccess(userId, workspaceId);
  const { rows, total } = await listChatsForWorkspacePaged(userId, workspaceId, window);
  return { items: rows.map(toWire), total };
}

export async function createChat(
  userId: string,
  workspaceId: string,
  input: { title?: string | undefined },
): Promise<Chat> {
  await assertWorkspaceAccess(userId, workspaceId);
  const existing = await findActiveChatForWorkspace(userId, workspaceId);
  if (existing) return toWire(existing);
  try {
    const inserted = await insertChat({
      userId,
      workspaceId,
      title: input.title ?? DEFAULT_TITLE,
    });
    return toWire(inserted);
  } catch (err) {
    if (isUniqueViolation(err)) {
      const winner = await findActiveChatForWorkspace(userId, workspaceId);
      if (winner) return toWire(winner);
    }
    throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  if (hasCode23505(err)) return true;
  if (typeof err === 'object' && err !== null && 'cause' in err) {
    return hasCode23505((err as { cause?: unknown }).cause);
  }
  return false;
}

function hasCode23505(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '23505'
  );
}

export async function getChat(userId: string, chatId: string): Promise<Chat> {
  const row = await findChatForUser(userId, chatId);
  if (!row) {
    throw new AppError('NOT_FOUND', 'Chat not found.', { exposeDetails: false });
  }
  return toWire(row);
}

export async function updateChat(
  userId: string,
  chatId: string,
  patch: {
    title?: string | undefined;
    isArchived?: boolean | undefined;
    isPublic?: boolean | undefined;
  },
): Promise<Chat> {
  const existing = await findChatForUser(userId, chatId);
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Chat not found.', { exposeDetails: false });
  }
  if (patch.title === undefined && patch.isArchived === undefined && patch.isPublic === undefined) {
    return toWire(existing);
  }
  const dbPatch: { title?: string; isArchived?: boolean; isPublic?: boolean } = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.isArchived !== undefined) dbPatch.isArchived = patch.isArchived;
  if (patch.isPublic !== undefined) dbPatch.isPublic = patch.isPublic;
  const updated = await updateChatForUser(userId, chatId, dbPatch);
  if (!updated) {
    throw new AppError('NOT_FOUND', 'Chat not found.', { exposeDetails: false });
  }
  return toWire(updated);
}

export async function deleteChat(
  userId: string,
  chatId: string,
): Promise<{ id: string; deleted: true }> {
  const deleted = await softDeleteChatForUser(userId, chatId);
  if (!deleted) {
    throw new AppError('NOT_FOUND', 'Chat not found.', { exposeDetails: false });
  }
  return { id: deleted.id, deleted: true as const };
}

export async function listMessages(userId: string, chatId: string): Promise<Message[]> {
  const chat = await findChatForUser(userId, chatId);
  if (!chat) {
    throw new AppError('NOT_FOUND', 'Chat not found.', { exposeDetails: false });
  }
  const rows = await listMessagesForChat(userId, chatId);
  const messageIds = rows.map((r) => r.id);
  const [chunkCites, webCites] = await Promise.all([
    hydrateChunkCitations(userId, messageIds),
    hydrateWebCitations(messageIds),
  ]);
  return rows.map((r) => messageRowToWire(r, chunkCites.get(r.id) ?? [], webCites.get(r.id) ?? []));
}

export async function setMessageReaction(
  userId: string,
  messageId: string,
  body: {
    reaction: 'like' | 'dislike' | null;
    dislikedReason?: DislikedReason | undefined;
    dislikedNote?: string | undefined;
  },
): Promise<Message> {
  const existing = await findMessageForUser(userId, messageId);
  if (!existing || existing.role !== 'assistant') {
    throw new AppError('NOT_FOUND', 'Message not found.', { exposeDetails: false });
  }

  const isDislike = body.reaction === 'dislike';
  const updated = await setMessageReactionForUser(userId, messageId, {
    reaction: body.reaction,
    dislikedReason: isDislike && body.dislikedReason !== undefined ? body.dislikedReason : null,
    dislikedNote: isDislike && body.dislikedNote !== undefined ? body.dislikedNote : null,
  });
  if (!updated) {
    throw new AppError('NOT_FOUND', 'Message not found.', { exposeDetails: false });
  }

  const [chunkCites, webCites] = await Promise.all([
    hydrateChunkCitations(userId, [updated.id]),
    hydrateWebCitations([updated.id]),
  ]);
  return messageRowToWire(
    updated,
    chunkCites.get(updated.id) ?? [],
    webCites.get(updated.id) ?? [],
  );
}

export function messageRowToWire(
  row: MessageRow,
  citations: readonly Citation[] = [],
  webCitations: readonly WebCitation[] = [],
): Message {
  return {
    id: row.id,
    chatId: row.chatId,
    role: row.role,
    content: row.content,
    modelName: row.modelName,
    consumedTokens: row.consumedTokens,
    reaction: row.reaction,
    dislikedReason: row.dislikedReason,
    responseOfMessageId: row.responseOfMessageId,
    citations: [...citations],
    webCitations: [...webCitations],
    createdAt: row.createdAt.toISOString(),
  };
}

async function assertWorkspaceAccess(userId: string, workspaceId: string): Promise<void> {
  const workspace = await findWorkspaceForUser(userId, workspaceId);
  if (!workspace) {
    throw new AppError('NOT_FOUND', 'Workspace not found.', { exposeDetails: false });
  }
}
