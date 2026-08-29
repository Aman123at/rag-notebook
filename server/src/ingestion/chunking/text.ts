import { CHUNKING } from '@/contract/domain/limits.js';
import type { ChunkLocator } from '@/contract/index.js';

import { estimateTokens, recursiveSplit } from './recursive.js';
import type { ChunkerInput, ProducedChunk } from './types.js';

export function chunkTextSource(input: ChunkerInput): ProducedChunk[] {
  const out: ProducedChunk[] = [];
  let chunkIndex = 0;

  for (const segment of input.segments) {
    if (segment.locator.kind !== 'text_range') {
      throw new Error(`chunkTextSource: expected text_range locator, got ${segment.locator.kind}`);
    }
    const segmentStart = segment.locator.startChar;
    const segmentEnd = segment.locator.endChar;
    const original = segment.text;
    if (original.length === 0) continue;

    const pieces =
      original.length <= CHUNKING.CHUNK_SIZE
        ? [original]
        : recursiveSplit(original, {
            size: CHUNKING.CHUNK_SIZE,
            overlap: CHUNKING.CHUNK_OVERLAP,
          });

    const multiPart = pieces.length > 1;
    let searchFrom = 0;
    for (let i = 0; i < pieces.length; i += 1) {
      const content = pieces[i] ?? '';
      if (content.length === 0) continue;
      const found = original.indexOf(content, searchFrom);
      const startChar = found >= 0 ? segmentStart + found : segmentStart;
      const endChar = found >= 0 ? startChar + content.length : segmentEnd;
      if (found >= 0) {
        searchFrom = Math.max(0, found + Math.max(1, content.length - CHUNKING.CHUNK_OVERLAP));
      }
      const locator: ChunkLocator = { kind: 'text_range', startChar, endChar };
      const chunk: ProducedChunk = {
        chunkIndex,
        content,
        embeddingText: buildEmbeddingText(input.sourceTitle, content),
        locator,
        tokenCount: estimateTokens(content),
      };
      if (multiPart) chunk.metadata = { part: i + 1 };
      out.push(chunk);
      chunkIndex += 1;
    }
  }
  return out;
}

function buildEmbeddingText(title: string, content: string): string {
  if (!CHUNKING.EMBEDDING_TEXT_HEADER) return content;
  return `[${title}]\n\n${content}`;
}
