import type OpenAI from 'openai';

import { type WebCitation } from '@/contract/index.js';

import { renderWebResultsBlock } from '../tools.js';

import { type CollectedToolCall } from './stream-round.js';
import { parseToolQuery } from './web-search.js';

export interface ToolRoundOutcome {
  nextMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];

  offer: { query: string } | null;
}

export async function dispatchToolRound(input: {
  messages: readonly OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  roundContent: string;
  toolCalls: ReadonlyMap<number, CollectedToolCall>;

  hasExecutedSearch(): boolean;

  executeWebSearch(query: string): Promise<readonly WebCitation[]>;
}): Promise<ToolRoundOutcome> {
  const assistantToolMessage: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
    role: 'assistant',
    content: input.roundContent.length > 0 ? input.roundContent : null,
    tool_calls: [...input.toolCalls.values()].map((tc) => ({
      id: tc.id,
      type: 'function' as const,
      function: { name: tc.name, arguments: tc.argsBuffer },
    })),
  };
  const nextMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    ...input.messages,
    assistantToolMessage,
  ];

  let offer: { query: string } | null = null;

  for (const tc of input.toolCalls.values()) {
    const query = parseToolQuery(tc.argsBuffer);

    if (tc.name === 'offer_web_search') {
      if (offer === null && query.length > 0) offer = { query };
      nextMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: 'Offer presented to the user. Do not answer further.',
      });
      continue;
    }

    if (tc.name !== 'web_search') {
      nextMessages.push({ role: 'tool', tool_call_id: tc.id, content: 'Tool not available.' });
      continue;
    }

    if (input.hasExecutedSearch()) {
      nextMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: 'Only one web search is allowed per message. Answer from the results you have.',
      });
      continue;
    }

    const fresh = await input.executeWebSearch(query);
    nextMessages.push({
      role: 'tool',
      tool_call_id: tc.id,
      content: renderWebResultsBlock(fresh),
    });
  }

  return { nextMessages, offer };
}
