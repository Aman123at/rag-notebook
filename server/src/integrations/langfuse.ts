import { observeOpenAI } from '@langfuse/openai';
import type OpenAINS from 'openai';
import type OpenAI from 'openai';

export interface ChatObservability {
  userId: string;
  workspaceId: string;
  chatId: string;
  messageId: string;
  model: string;
  sourceCount: number;
  retrievedChunkCount: number;
  webSearch: boolean;

  generationName?: string;
}

export function observedChatClient(client: OpenAI, observability: ChatObservability): OpenAI {
  return observeOpenAI(client, {
    userId: observability.userId,
    sessionId: observability.chatId,
    tags: buildTags(observability),
    generationName: observability.generationName ?? 'chat.completion',
    generationMetadata: {
      workspaceId: observability.workspaceId,
      chatId: observability.chatId,
      messageId: observability.messageId,
      model: observability.model,
      sourceCount: observability.sourceCount,
      retrievedChunkCount: observability.retrievedChunkCount,
      webSearch: observability.webSearch,
    },
  });
}

function buildTags(o: ChatObservability): string[] {
  const tags = ['chat'];
  if (o.webSearch) tags.push('web-search');
  if (o.retrievedChunkCount > 0) tags.push('with-retrieval');
  if (o.retrievedChunkCount === 0) tags.push('no-retrieval');
  return tags;
}

export type { OpenAINS };
