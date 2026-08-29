import type { ChunkLocator } from '@/contract/index.js';
import type { ExtractionResult } from '@/ingestion/extractors/index.js';

import { chunkPagedSource } from './page.js';
import { chunkTextSource } from './text.js';
import { chunkTimestampSource } from './timestamp.js';
import type { ChunkerInput, ProducedChunk } from './types.js';
import { chunkWebSource } from './web.js';

export function chunkExtraction(extraction: ExtractionResult): ProducedChunk[] {
  const input: ChunkerInput = {
    sourceTitle: extraction.title,
    segments: extraction.segments,
  };
  if (extraction.segments.length === 0) return [];
  const first = extraction.segments[0];
  if (!first) return [];
  const kind: ChunkLocator['kind'] = first.locator.kind;
  switch (kind) {
    case 'pdf_page':
      return chunkPagedSource(input);
    case 'timestamp':
      return chunkTimestampSource(input);
    case 'web':
      return chunkWebSource(input);
    case 'text_range':
      return chunkTextSource(input);
  }
}

export { chunkPagedSource } from './page.js';
export { estimateTokens, recursiveSplit, characterStep } from './recursive.js';
export { chunkTextSource } from './text.js';
export { chunkTimestampSource } from './timestamp.js';
export type { ChunkerInput, ProducedChunk } from './types.js';
export { chunkWebSource } from './web.js';
