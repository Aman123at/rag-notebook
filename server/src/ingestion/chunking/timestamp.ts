import { CHUNKING } from '@/contract/domain/limits.js';
import type { ChunkLocator } from '@/contract/index.js';

import { estimateTokens, recursiveSplit } from './recursive.js';
import type { ChunkerInput, ProducedChunk } from './types.js';

interface CueSegment {
  text: string;
  startMs: number;
  endMs: number;
  videoId?: string | undefined;
}

export function chunkTimestampSource(input: ChunkerInput): ProducedChunk[] {
  const cues: CueSegment[] = [];
  for (const segment of input.segments) {
    if (segment.locator.kind !== 'timestamp') {
      throw new Error(
        `chunkTimestampSource: expected timestamp locator, got ${segment.locator.kind}`,
      );
    }
    const text = segment.text.trim();
    if (text.length === 0) continue;
    const cue: CueSegment = {
      text,
      startMs: segment.locator.startMs,
      endMs: segment.locator.endMs,
    };
    if (segment.locator.videoId !== undefined) cue.videoId = segment.locator.videoId;
    cues.push(cue);
  }
  if (cues.length === 0) return [];

  const merged = mergeCues(cues);
  const out: ProducedChunk[] = [];
  let chunkIndex = 0;
  for (const m of merged) {
    const locator = timestampLocator(m);
    if (m.text.length <= CHUNKING.CHUNK_SIZE) {
      out.push(makeChunk(input.sourceTitle, chunkIndex, m.text, locator));
      chunkIndex += 1;
      continue;
    }
    const pieces = recursiveSplit(m.text, {
      size: CHUNKING.CHUNK_SIZE,
      overlap: CHUNKING.CHUNK_OVERLAP,
    });
    for (let i = 0; i < pieces.length; i += 1) {
      const piece = pieces[i] ?? '';
      if (piece.length === 0) continue;
      out.push({
        ...makeChunk(input.sourceTitle, chunkIndex, piece, locator),
        metadata: { part: i + 1 },
      });
      chunkIndex += 1;
    }
  }
  return out;
}

function mergeCues(cues: CueSegment[]): CueSegment[] {
  const out: CueSegment[] = [];
  let current: CueSegment | null = null;
  for (const cue of cues) {
    if (current === null) {
      current = { ...cue };
      continue;
    }
    const spanMs = cue.endMs - current.startMs;
    const combinedText = `${current.text} ${cue.text}`;
    const gapMs = cue.startMs - current.endMs;
    const topicBoundary = gapMs > CHUNKING.VTT_TOPIC_GAP_MS;
    const wouldExceedTime = spanMs > CHUNKING.VTT_CHUNK_TARGET_MS;
    const wouldExceedSize = combinedText.length > CHUNKING.CHUNK_SIZE;
    const differentVideo = current.videoId !== cue.videoId;
    if (topicBoundary || wouldExceedTime || wouldExceedSize || differentVideo) {
      out.push(current);
      current = { ...cue };
    } else {
      current.text = combinedText;
      current.endMs = cue.endMs;
    }
  }
  if (current !== null) out.push(current);
  return out;
}

function timestampLocator(cue: CueSegment): ChunkLocator {
  const locator: Extract<ChunkLocator, { kind: 'timestamp' }> = {
    kind: 'timestamp',
    startMs: cue.startMs,
    endMs: cue.endMs,
  };
  if (cue.videoId !== undefined) locator.videoId = cue.videoId;
  return locator;
}

function makeChunk(
  title: string,
  chunkIndex: number,
  content: string,
  locator: ChunkLocator,
): ProducedChunk {
  return {
    chunkIndex,
    content,
    embeddingText: buildEmbeddingText(title, locator, content),
    locator,
    tokenCount: estimateTokens(content),
  };
}

function buildEmbeddingText(title: string, locator: ChunkLocator, content: string): string {
  if (!CHUNKING.EMBEDDING_TEXT_HEADER) return content;
  if (locator.kind !== 'timestamp') return content;
  const start = formatTimestamp(locator.startMs);
  const end = formatTimestamp(locator.endMs);
  return `[${title} · ${start}–${end}]\n\n${content}`;
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
