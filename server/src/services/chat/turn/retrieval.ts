import { type Citation, RETRIEVAL } from '@/contract/index.js';
import { logger } from '@/observability/logger.js';
import { retrieve, type RetrievedChunk } from '@/retrieval/index.js';

const SNIPPET_MAX_CHARS = 300;

export interface TurnRetrieval {
  chunks: RetrievedChunk[];
  citations: Citation[];

  unavailable: boolean;
}

export async function retrieveForTurn(input: {
  userId: string;
  workspaceId: string;
  chatId: string;
  query: string;
}): Promise<TurnRetrieval> {
  try {
    const retrieved = await retrieve({
      userId: input.userId,
      workspaceId: input.workspaceId,
      query: input.query,
      topK: RETRIEVAL.finalTopK,
    });
    return {
      chunks: retrieved.chunks,
      citations: retrieved.chunks.map((c) => toCitation(c)),
      unavailable: false,
    };
  } catch (err) {
    logger.warn(
      {
        event: 'chat.retrieval.degraded',
        userId: input.userId,
        chatId: input.chatId,
        err: err instanceof Error ? err.message : String(err),
      },
      'Retrieval unavailable — proceeding with empty context',
    );
    return { chunks: [], citations: [], unavailable: true };
  }
}

export function toCitation(chunk: RetrievedChunk): Citation {
  return {
    index: chunk.rank,
    chunkId: chunk.chunkId,
    sourceId: chunk.sourceId,
    sourceTitle: chunk.sourceTitle,
    sourceType: chunk.sourceType,
    locator: chunk.locator,
    snippet: chunk.content.slice(0, SNIPPET_MAX_CHARS),
    score: chunk.fusedScore,
    ...(chunk.deepLink ? { deepLink: chunk.deepLink } : {}),
  };
}
