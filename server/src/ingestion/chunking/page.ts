import { CHUNKING } from '@/contract/domain/limits.js';
import type { ChunkLocator } from '@/contract/index.js';

import { estimateTokens, recursiveSplit } from './recursive.js';
import type { ChunkerInput, ProducedChunk } from './types.js';

export function chunkPagedSource(input: ChunkerInput): ProducedChunk[] {
  const out: ProducedChunk[] = [];
  let chunkIndex = 0;
  for (const segment of input.segments) {
    if (segment.locator.kind !== 'pdf_page') {
      throw new Error(`chunkPagedSource: expected pdf_page locator, got ${segment.locator.kind}`);
    }
    const text = segment.text.trim();
    if (text.length === 0) continue;
    const pieces =
      text.length <= CHUNKING.CHUNK_SIZE
        ? [text]
        : recursiveSplit(text, {
            size: CHUNKING.CHUNK_SIZE,
            overlap: CHUNKING.CHUNK_OVERLAP,
          });
    const multiPart = pieces.length > 1;
    for (let i = 0; i < pieces.length; i += 1) {
      const content = pieces[i] ?? '';
      if (content.length === 0) continue;
      const locator: ChunkLocator = segment.locator;
      const chunk: ProducedChunk = {
        chunkIndex,
        content,
        embeddingText: buildEmbeddingText(input.sourceTitle, locator, content),
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

function buildEmbeddingText(
  title: string,
  locator: Extract<ChunkLocator, { kind: 'pdf_page' }>,
  content: string,
): string {
  if (!CHUNKING.EMBEDDING_TEXT_HEADER) return content;
  return `[${title} · page ${locator.page}]\n\n${content}`;
}
