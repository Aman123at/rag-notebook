import type { ChunkLocator, SourceType } from '@/contract/index.js';

export interface RetrievedChunk {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  sourceType: SourceType;
  locator: ChunkLocator;

  content: string;
  chunkIndex: number;
  tokenCount: number;

  rank: number;

  fusedScore: number;

  deepLink: string | null;
}

export interface RetrieveInput {
  userId: string;
  workspaceId: string;
  query: string;

  topK?: number;
}

export interface RetrieveResult {
  chunks: RetrievedChunk[];

  meta: {
    denseHits: number;
    sparseHits: number;
    fusedHits: number;

    distinctSources: number;
    latencyMs: number;
  };
}

export interface PromptExtras {
  summary?: string | undefined;

  memories?: readonly string[] | undefined;
}

export type WebSearchMode = 'off' | 'enabled' | 'answering' | 'offer' | 'exhausted';

export interface PromptOptions {
  contextTokenBudget: number;
  extras?: PromptExtras | undefined;
  retrievalUnavailable?: boolean | undefined;

  webSearchMode?: WebSearchMode | undefined;
}

export interface AssembledPrompt {
  systemPrompt: string;

  usedChunks: RetrievedChunk[];

  tokensUsed: number;

  chunksDropped: number;
}
