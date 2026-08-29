import type OpenAI from 'openai';

import { type WebCitation } from '@/contract/index.js';
import { webSearch, type WebSearchOutcome } from '@/integrations/tavily.js';

export const MAX_TOOL_ROUNDS = 2;

export const WEB_SEARCH_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Search the public web for recent information. Use when the user asks about news, current events, or facts that the retrieved-document context does not cover. Cite the returned URLs in your answer.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query, in natural language. Keep under 200 characters.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    strict: true,
  },
};

export const OFFER_WEB_SEARCH_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'offer_web_search',
    description:
      "Ask the user for permission to search the public web. Call this when the user's own documents do not cover their question and a web search plausibly would. Do not call it for greetings, small talk, or questions about this conversation.",
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'The web search query you would run, in natural language. Keep under 200 characters.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    strict: true,
  },
};

export function renderWebSearchOffer(query: string): string {
  return `I couldn't find anything about this in the sources you've added. ${renderWebSearchQuestion(query)}`;
}

export function renderWebSearchQuestion(query: string): string {
  return `Would you like me to search the web for "${query}" instead?`;
}

export function renderWebSearchExhausted(max: number): string {
  return `You've used all ${max} web searches for this chat, so I can only answer from your sources here. Start a new chat if you need to search the web again.\n\n`;
}

export function toWebCitations(outcome: WebSearchOutcome, startIndex: number): WebCitation[] {
  return outcome.results.map((r, i) => ({
    index: startIndex + i,
    url: r.url,
    title: r.title,
    snippet: r.snippet,
  }));
}

export function renderWebResultsBlock(citations: readonly WebCitation[]): string {
  if (citations.length === 0) return 'WEB RESULTS: <empty />';
  const lines: string[] = ['WEB RESULTS:'];
  for (const c of citations) {
    lines.push(
      `<web n="${c.index}" url="${escapeAttr(c.url)}" title="${escapeAttr(c.title)}">`,
      c.snippet,
      '</web>',
    );
  }
  return lines.join('\n');
}

export async function runWebSearch(query: string): Promise<WebSearchOutcome> {
  const trimmed = query.trim().slice(0, 400);
  return webSearch(trimmed);
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
