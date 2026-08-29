import { CHUNKING } from '@/contract/domain/limits.js';

export interface SplitOptions {
  size: number;
  overlap: number;

  separators?: readonly string[];
}

export const MIN_CHUNK_CHARS = 200;

const ABBREVIATIONS: ReadonlySet<string> = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'st',
  'mt',
  'inc',
  'ltd',
  'co',
  'corp',
  'llc',
  'plc',
  'e.g',
  'i.e',
  'etc',
  'vs',
  'viz',
  'cf',
  'al',
  'no',
  'vol',
  'fig',
  'ch',
  'sec',
  'jan',
  'feb',
  'mar',
  'apr',
  'jun',
  'jul',
  'aug',
  'sep',
  'sept',
  'oct',
  'nov',
  'dec',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
  'a.m',
  'p.m',
  'u.s',
  'u.k',
  'u.n',
]);

export function recursiveSplit(text: string, opts: SplitOptions): string[] {
  const size = opts.size;
  const overlap = Math.max(0, Math.min(opts.overlap, size - 1));
  if (size <= 0) return [];
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= size) return [trimmed];

  const sentences = splitIntoSentences(trimmed);
  if (sentences.length === 0) return [trimmed];

  return packSentences(sentences, size, overlap);
}

export function splitIntoSentences(text: string): string[] {
  const out: string[] = [];
  const len = text.length;
  let start = 0;
  let i = 0;

  while (i < len) {
    const ch = text[i];

    if (ch === '\n') {
      let j = i;
      while (j < len && text[j] === '\n') j += 1;
      if (j - i >= 2) {
        const seg = text.slice(start, i).trim();
        if (seg.length > 0) out.push(seg);
        start = j;
        i = j;
        continue;
      }
    }

    if (ch === '.' || ch === '!' || ch === '?' || ch === '…') {
      let end = i + 1;
      while (
        end < len &&
        (text[end] === '.' || text[end] === '!' || text[end] === '?' || text[end] === '…')
      ) {
        end += 1;
      }
      if (isRealSentenceEnd(text, i, end)) {
        const seg = text.slice(start, end).trim();
        if (seg.length > 0) out.push(seg);

        start = end;
        while (start < len && /\s/.test(text[start] ?? '')) start += 1;
        i = start;
        continue;
      }
      i = end;
      continue;
    }
    i += 1;
  }

  if (start < len) {
    const seg = text.slice(start).trim();
    if (seg.length > 0) out.push(seg);
  }
  return out;
}

function isRealSentenceEnd(text: string, dotIdx: number, endIdx: number): boolean {
  const first = text[dotIdx];

  if (first === '.' && endIdx - dotIdx === 1) {
    const prev = text[dotIdx - 1] ?? '';
    const next = text[dotIdx + 1] ?? '';
    if (/[0-9]/.test(prev) && /[0-9]/.test(next)) return false;

    let s = dotIdx - 1;
    while (s >= 0 && /[A-Za-z.]/.test(text[s] ?? '')) s -= 1;
    const token = text.slice(s + 1, dotIdx).toLowerCase();
    if (token.length > 0 && ABBREVIATIONS.has(token)) return false;

    if (token.length === 1 && /[A-Z]/.test(text[s + 1] ?? '')) return false;
  }

  if (endIdx >= text.length) return true;
  return /\s/.test(text[endIdx] ?? '');
}

function packSentences(sentences: readonly string[], size: number, overlap: number): string[] {
  const chunks: string[] = [];
  let buf: string[] = [];
  let bufLen = 0;

  const pushChunk = () => {
    if (buf.length === 0) return;
    chunks.push(joinSentences(buf));

    if (overlap > 0) {
      const tail: string[] = [];
      let tailLen = 0;
      for (let k = buf.length - 1; k >= 0; k -= 1) {
        const s = buf[k] ?? '';
        const add = tailLen === 0 ? s.length : s.length + 1;
        if (tailLen + add > overlap && tail.length > 0) break;
        tail.unshift(s);
        tailLen += add;
      }
      buf = tail;
      bufLen = tailLen;
    } else {
      buf = [];
      bufLen = 0;
    }
  };

  for (const sentence of sentences) {
    if (sentence.length > size) {
      pushChunk();

      if (buf.length > 0) {
        chunks.push(joinSentences(buf));
        buf = [];
        bufLen = 0;
      }
      for (const piece of characterSplit(sentence, size, overlap)) {
        chunks.push(piece);
      }
      continue;
    }
    const addLen = bufLen === 0 ? sentence.length : sentence.length + 1;
    if (bufLen + addLen <= size) {
      buf.push(sentence);
      bufLen += addLen;
      continue;
    }
    pushChunk();

    const seedLen = buf.length === 0 ? 0 : bufLen;
    const seedPlusNew = seedLen === 0 ? sentence.length : seedLen + 1 + sentence.length;
    if (seedPlusNew > size) {
      buf = [];
      bufLen = 0;
    }
    buf.push(sentence);
    bufLen += bufLen === 0 ? sentence.length : sentence.length + 1;
  }
  if (buf.length > 0) chunks.push(joinSentences(buf));

  return coalesceTail(chunks, size);
}

function joinSentences(sentences: readonly string[]): string {
  return sentences.join(' ').trim();
}

function coalesceTail(chunks: string[], size: number): string[] {
  if (chunks.length < 2) return chunks;
  const last = chunks[chunks.length - 1] ?? '';
  const effectiveMin = Math.min(MIN_CHUNK_CHARS, Math.floor(size / 2));
  if (last.length >= effectiveMin) return chunks;
  const prev = chunks[chunks.length - 2] ?? '';
  const merged = `${prev} ${last}`.trim();
  if (merged.length > size) return chunks;
  return [...chunks.slice(0, -2), merged];
}

function characterSplit(text: string, size: number, overlap: number): string[] {
  const out: string[] = [];
  const step = characterStep(size, overlap);
  for (let i = 0; i < text.length; i += step) {
    const piece = text.slice(i, i + size);
    if (piece.length > 0) out.push(piece);
    if (i + size >= text.length) break;
  }
  return out;
}

export function characterStep(size: number, overlap: number): number {
  if (size <= 1) return 1;
  const raw = size - Math.max(0, overlap);
  if (raw < 1) return 1;
  if (raw >= size) return size - 1;
  return raw;
}

export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

void CHUNKING;
