import { type Citation, type WebCitation } from '@/contract/index.js';
import { insertMessageWithReferences } from '@/repository/messages.repo.js';

import { type TurnMetadata, type WebSearchUsage } from '../consent.js';

export function extractReferencedIndices(content: string): Set<number> {
  const out = new Set<number>();
  const re = /\[([\d,\s]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const body = match[1];
    if (body === undefined) continue;
    for (const part of body.split(',')) {
      const n = Number.parseInt(part.trim(), 10);
      if (Number.isInteger(n) && n > 0) out.add(n);
    }
  }
  return out;
}

export interface CitedSubsets {
  citations: Citation[];
  webCitations: WebCitation[];

  citationsNarrowed: boolean;

  webCitationsNarrowed: boolean;
}

export function selectCitedSubsets(
  assistantContent: string,
  citations: readonly Citation[],
  webCitations: readonly WebCitation[],
): CitedSubsets {
  const referenced = extractReferencedIndices(assistantContent);
  const used = citations.filter((c) => referenced.has(c.index));
  const usedWeb = webCitations.filter((w) => referenced.has(w.index));
  return {
    citations: used,
    webCitations: usedWeb,
    citationsNarrowed: used.length !== citations.length,
    webCitationsNarrowed: webCitations.length > 0 && usedWeb.length !== webCitations.length,
  };
}

export async function persistAssistantTurn(input: {
  assistantMessageId: string;
  chatId: string;
  userId: string;
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  consumedTokens: number;
  finishReason: 'aborted' | 'length' | 'stop' | 'tool';
  responseOfMessageId: string;
  citations: readonly Citation[];
  webCitations: readonly WebCitation[];

  executedSearch: WebSearchUsage | null;

  offeredSearch: { query: string } | null;
}): Promise<void> {
  const turnMetadata: TurnMetadata = {
    ...(input.executedSearch !== null ? { webSearch: input.executedSearch } : {}),
    ...(input.offeredSearch !== null ? { webSearchOffer: input.offeredSearch } : {}),
  };

  await insertMessageWithReferences(
    {
      id: input.assistantMessageId,
      chatId: input.chatId,
      userId: input.userId,
      role: 'assistant',
      content: input.content,
      modelName: input.model,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      consumedTokens: input.consumedTokens,
      finishReason: input.finishReason,
      responseOfMessageId: input.responseOfMessageId,
      ...(Object.keys(turnMetadata).length > 0 ? { metadata: turnMetadata } : {}),
    },
    {
      chunks: input.citations.map((c) => ({
        chunkId: c.chunkId,
        citationIndex: c.index,
        score: c.score.toFixed(6),
      })),
      webs: input.webCitations.map((w) => ({
        citationIndex: w.index,
        url: w.url,
        title: w.title,
        snippet: w.snippet,
      })),
    },
  );
}
