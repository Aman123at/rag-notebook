import { searchMemories } from '@/integrations/mem0.js';
import { findChatForUser } from '@/repository/chats.repo.js';
import type { ChatContextExtras } from '@/types/chats.types.js';

export async function fetchExtrasForTurn(
  userId: string,
  chatId: string,
  query: string,
  workspaceId: string,
): Promise<ChatContextExtras> {
  const [memories, chat] = await Promise.all([
    searchMemories(userId, query, workspaceId),
    findChatForUser(userId, chatId),
  ]);
  const summary = chat?.summary && chat.summary.trim().length > 0 ? chat.summary : null;
  return { memories, summary };
}
