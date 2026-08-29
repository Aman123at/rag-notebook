import { createHash } from 'node:crypto';

import { throwIngestionError } from '@/inngest/errors.js';

import type { ExtractedSegment, ExtractionResult, Extractor, ExtractorSource } from './types.js';

const MAX_TEXT_BYTES = 10 * 1024 * 1024;

export function normaliseText(raw: string): string {
  let s = raw;
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s.replace(/\r\n?/g, '\n');
}

export function splitParagraphs(
  normalised: string,
): Array<{ text: string; startChar: number; endChar: number }> {
  const segments: Array<{ text: string; startChar: number; endChar: number }> = [];
  const re = /\n{2,}/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalised)) !== null) {
    const startChar = cursor;
    const endChar = match.index;
    const text = normalised.slice(startChar, endChar).trim();
    if (text.length > 0) segments.push({ text, startChar, endChar });
    cursor = re.lastIndex;
  }
  const tail = normalised.slice(cursor);
  const trimmedTail = tail.trim();
  if (trimmedTail.length > 0) {
    segments.push({ text: trimmedTail, startChar: cursor, endChar: normalised.length });
  }
  return segments;
}

export interface TextExtractorInput extends ExtractorSource {
  content: string;
}

export class TextExtractor implements Extractor {
  async extract(source: ExtractorSource): Promise<ExtractionResult> {
    const input = source as TextExtractorInput;
    if (typeof input.content !== 'string') {
      throwIngestionError('EXTRACTION_FAILED', 'Text extractor invoked without loaded content.');
    }
    return extractFromString(source, input.content);
  }
}

export async function extractFromString(
  source: ExtractorSource,
  raw: string,
): Promise<ExtractionResult> {
  return Promise.resolve(extractFromStringSync(source, raw));
}

function extractFromStringSync(source: ExtractorSource, raw: string): ExtractionResult {
  if (raw.length > MAX_TEXT_BYTES) {
    throwIngestionError('CONTENT_TOO_LARGE', `Text file exceeds ${MAX_TEXT_BYTES} bytes.`);
  }
  const normalised = normaliseText(raw);
  const paragraphs = splitParagraphs(normalised);
  if (paragraphs.length === 0) {
    throwIngestionError('PARSE_FAILURE', 'Text file is empty or whitespace-only.');
  }
  const segments: ExtractedSegment[] = paragraphs.map((p) => ({
    text: p.text,
    locator: { kind: 'text_range', startChar: p.startChar, endChar: p.endChar },
  }));
  return {
    title: source.title,
    segments,
    metadata: {
      byteLength: raw.length,
      normalisedByteLength: normalised.length,
      paragraphCount: segments.length,
    },
    contentHash: sha256Hex(normalised),
  };
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export const textExtractor = new TextExtractor();
