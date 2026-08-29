import type { ChunkLocator } from '@/contract/index.js';

export interface ProducedChunk {
  chunkIndex: number;

  content: string;

  embeddingText: string;
  locator: ChunkLocator;
  tokenCount: number;

  metadata?: { part?: number } | undefined;
}

export interface ChunkerInput {
  sourceTitle: string;
  segments: readonly {
    text: string;
    locator: ChunkLocator;
    metadata?: Record<string, unknown> | undefined;
  }[];
}
