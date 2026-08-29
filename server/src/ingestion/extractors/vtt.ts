import { createHash } from 'node:crypto';

import { throwIngestionError } from '@/inngest/errors.js';

import type { ExtractedSegment, ExtractionResult, Extractor, ExtractorSource } from './types.js';

const VTT_MAGIC = 'WEBVTT';

const TIMESTAMP_RE =
  /^\s*((?:\d{1,4}:)?\d{1,2}:\d{2}\.\d{3})\s*-->\s*((?:\d{1,4}:)?\d{1,2}:\d{2}\.\d{3})(?:\s+.*)?$/;

export function parseVttTimestamp(raw: string): number {
  const m = /^(?:(\d{1,4}):)?(\d{1,2}):(\d{2})\.(\d{3})$/.exec(raw.trim());
  if (!m) {
    throwIngestionError('PARSE_FAILURE', `Malformed VTT timestamp: "${raw}".`);
  }
  const hours = m[1] ? Number(m[1]) : 0;
  const minutes = Number(m[2]);
  const seconds = Number(m[3]);
  const millis = Number(m[4]);
  if (minutes >= 60 || seconds >= 60) {
    throwIngestionError('PARSE_FAILURE', `Out-of-range VTT timestamp: "${raw}".`);
  }
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
}

export function stripVttMarkup(payload: string): { text: string; speaker: string | null } {
  let speaker: string | null = null;
  const voiceOpenRe = /<v(?:\.[A-Za-z0-9-_]+)*\s+([^>]+)>/;
  const first = voiceOpenRe.exec(payload);
  if (first?.[1]) speaker = first[1].trim();
  const stripped = payload

    .replace(/<\d{1,4}:\d{1,2}:\d{2}\.\d{3}>/g, '')
    .replace(/<\d{1,2}:\d{2}\.\d{3}>/g, '')

    .replace(/<v(?:\.[A-Za-z0-9-_]+)*\s+[^>]+>/g, '')
    .replace(/<\/v>/g, '')

    .replace(/<[^>]+>/g, '');
  return { text: collapseWhitespace(stripped), speaker };
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

interface VttCue {
  startMs: number;
  endMs: number;
  text: string;
  speaker: string | null;
  identifier: string | null;
}

export function parseVtt(raw: string): VttCue[] {
  const normalised = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const firstLineEnd = normalised.indexOf('\n');
  const firstLine = (firstLineEnd === -1 ? normalised : normalised.slice(0, firstLineEnd)).trim();
  if (!firstLine.startsWith(VTT_MAGIC)) {
    throwIngestionError('PARSE_FAILURE', 'File does not start with the required WEBVTT header.');
  }

  const body = firstLineEnd === -1 ? '' : normalised.slice(firstLineEnd + 1);

  const blocks = body.split(/\n{2,}/);
  const cues: VttCue[] = [];
  for (const block of blocks) {
    const trimmed = block.replace(/^\n+|\n+$/g, '');
    if (trimmed.length === 0) continue;
    if (isMetadataBlock(trimmed)) continue;
    const cue = parseBlockAsCue(trimmed);
    if (cue) cues.push(cue);
  }
  return cues;
}

function isMetadataBlock(block: string): boolean {
  const firstLine = block.split('\n', 1)[0] ?? '';
  return (
    firstLine === 'NOTE' ||
    firstLine.startsWith('NOTE ') ||
    firstLine === 'STYLE' ||
    firstLine === 'REGION'
  );
}

function parseBlockAsCue(block: string): VttCue | null {
  const lines = block.split('\n');

  let idx = 0;
  let identifier: string | null = null;
  const first = lines[idx] ?? '';
  if (!first.includes('-->')) {
    identifier = first.trim() || null;
    idx += 1;
  }
  const timestampLine = lines[idx];
  if (timestampLine === undefined) return null;
  const m = TIMESTAMP_RE.exec(timestampLine);
  if (!m || m[1] === undefined || m[2] === undefined) {
    throwIngestionError('PARSE_FAILURE', `Malformed VTT cue timestamp line: "${timestampLine}".`);
  }
  const startMs = parseVttTimestamp(m[1]);
  const endMs = parseVttTimestamp(m[2]);
  if (endMs < startMs) {
    throwIngestionError('PARSE_FAILURE', `VTT cue end (${endMs}ms) precedes start (${startMs}ms).`);
  }
  const payloadLines = lines.slice(idx + 1);
  const payload = payloadLines.join('\n');
  const { text, speaker } = stripVttMarkup(payload);
  if (text.length === 0) return null;
  return { startMs, endMs, text, speaker, identifier };
}

export interface VttExtractorInput extends ExtractorSource {
  content: string;
}

export class VttExtractor implements Extractor {
  // eslint-disable-next-line @typescript-eslint/require-await
  async extract(source: ExtractorSource): Promise<ExtractionResult> {
    const input = source as VttExtractorInput;
    if (typeof input.content !== 'string') {
      throwIngestionError('EXTRACTION_FAILED', 'VTT extractor invoked without loaded content.');
    }
    return extractVttFromString(source, input.content);
  }
}

export function extractVttFromString(
  source: ExtractorSource,
  raw: string,
): ExtractionResult {
  const cues = parseVtt(raw);
  if (cues.length === 0) {
    throwIngestionError('PARSE_FAILURE', 'VTT file contained no valid cues.');
  }
  const segments: ExtractedSegment[] = cues.map((cue) => {
    const segment: ExtractedSegment = {
      text: cue.text,
      locator: { kind: 'timestamp', startMs: cue.startMs, endMs: cue.endMs },
    };
    if (cue.speaker !== null || cue.identifier !== null) {
      const metadata: Record<string, unknown> = {};
      if (cue.speaker !== null) metadata['speaker'] = cue.speaker;
      if (cue.identifier !== null) metadata['identifier'] = cue.identifier;
      segment.metadata = metadata;
    }
    return segment;
  });
  const totalDurationMs = (cues.at(-1)?.endMs ?? 0) - (cues[0]?.startMs ?? 0);
  const canonical = cues.map((c) => `${c.startMs}\t${c.endMs}\t${c.text}`).join('\n');
  return {
    title: source.title,
    segments,
    metadata: {
      cueCount: cues.length,
      totalDurationMs,
      speakers: uniqueSpeakers(cues),
    },
    contentHash: createHash('sha256').update(canonical, 'utf8').digest('hex'),
  };
}

function uniqueSpeakers(cues: VttCue[]): string[] {
  const seen = new Set<string>();
  for (const c of cues) if (c.speaker) seen.add(c.speaker);
  return [...seen];
}

export const vttExtractor = new VttExtractor();
