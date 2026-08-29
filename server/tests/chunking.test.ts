import { describe, expect, it } from 'vitest';

import {
  characterStep,
  estimateTokens,
  MIN_CHUNK_CHARS,
  recursiveSplit,
  splitIntoSentences,
} from '../src/ingestion/chunking/recursive.js';
import { chunkTextSource } from '../src/ingestion/chunking/text.js';
import { extractFromString } from '../src/ingestion/extractors/text.js';

describe('splitIntoSentences', () => {
  it('splits on ., !, ? followed by whitespace + capital', () => {
    expect(splitIntoSentences('One. Two! Three?')).toEqual(['One.', 'Two!', 'Three?']);
  });

  it('keeps decimals inside a sentence', () => {
    const out = splitIntoSentences('Pi is 3.14 approximately. Next sentence.');
    expect(out).toEqual(['Pi is 3.14 approximately.', 'Next sentence.']);
  });

  it('does not break at common abbreviations', () => {
    const s = 'Dr. Smith met Mr. Jones at 5 p.m. yesterday. Then they left.';
    const out = splitIntoSentences(s);
    expect(out).toEqual(['Dr. Smith met Mr. Jones at 5 p.m. yesterday.', 'Then they left.']);
  });

  it('does not break inside e.g. / i.e.', () => {
    const out = splitIntoSentences('Use citations, e.g. page numbers, always. Right?');
    expect(out).toEqual(['Use citations, e.g. page numbers, always.', 'Right?']);
  });

  it('treats a paragraph break as a hard boundary even without punctuation', () => {
    const out = splitIntoSentences('Heading\n\nBody starts here.');
    expect(out).toEqual(['Heading', 'Body starts here.']);
  });

  it('collapses runs of terminators', () => {
    const out = splitIntoSentences('Wow!!! Really? Yes.');
    expect(out).toEqual(['Wow!!!', 'Really?', 'Yes.']);
  });
});

describe('recursiveSplit', () => {
  it('returns the input unchanged when it fits in one chunk', () => {
    const out = recursiveSplit('Short.', { size: 100, overlap: 10 });
    expect(out).toEqual(['Short.']);
  });

  it('every chunk fits inside `size`', () => {
    const text = generateSentences(50);
    const size = 400;
    const out = recursiveSplit(text, { size, overlap: 80 });
    for (const c of out) expect(c.length).toBeLessThanOrEqual(size);
    expect(out.length).toBeGreaterThan(1);
  });

  it('every chunk appears verbatim in the source (citations resolve)', () => {
    const text = generateSentences(60);
    const out = recursiveSplit(text, { size: 300, overlap: 60 });
    for (const c of out) {
      expect(text.includes(c)).toBe(true);
    }
  });

  it('adjacent chunks overlap by at least one sentence when overlap > 0', () => {
    const text = generateSentences(40);
    const out = recursiveSplit(text, { size: 250, overlap: 80 });
    if (out.length < 2) return;
    for (let i = 1; i < out.length; i += 1) {
      const prev = out[i - 1] ?? '';
      const cur = out[i] ?? '';

      let overlapsFound = false;
      for (let k = 30; k <= Math.min(prev.length, cur.length); k += 1) {
        if (prev.endsWith(cur.slice(0, k))) {
          overlapsFound = true;
          break;
        }
      }
      expect(overlapsFound).toBe(true);
    }
  });

  it('coalesces a tiny trailing chunk into the previous', () => {
    const long = 'A. '.repeat(200) + 'End.';
    const out = recursiveSplit(long, { size: 400, overlap: 40 });
    const last = out[out.length - 1] ?? '';
    expect(last.length).toBeGreaterThanOrEqual(MIN_CHUNK_CHARS);
  });

  it('handles a single sentence bigger than size via character split', () => {
    const monster = 'x'.repeat(1500);
    const out = recursiveSplit(monster, { size: 400, overlap: 50 });
    expect(out.length).toBeGreaterThan(1);
    for (const c of out) expect(c.length).toBeLessThanOrEqual(400);
  });

  it('progress is monotonic even when overlap >= size', () => {
    const monster = 'y'.repeat(600);
    const out = recursiveSplit(monster, { size: 100, overlap: 500 });
    expect(out.length).toBeGreaterThan(0);
    for (const c of out) expect(c.length).toBeLessThanOrEqual(100);
  });

  it('empty or whitespace-only input returns []', () => {
    expect(recursiveSplit('', { size: 100, overlap: 10 })).toEqual([]);
    expect(recursiveSplit('   \n\n  ', { size: 100, overlap: 10 })).toEqual([]);
  });
});

describe('characterStep', () => {
  it('clamps step into [1, size-1]', () => {
    expect(characterStep(10, 0)).toBe(9);
    expect(characterStep(10, 15)).toBe(1);
    expect(characterStep(1, 5)).toBe(1);
    expect(characterStep(5, 0)).toBe(4);
    expect(characterStep(100, 20)).toBe(80);
  });
});

describe('estimateTokens', () => {
  it('rounds up to ~len/4 tokens; zero-length is 0', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('xxxx')).toBe(1);
    expect(estimateTokens('x'.repeat(100))).toBe(25);
  });
});

function generateSentences(n: number): string {
  const parts: string[] = [];
  for (let i = 0; i < n; i += 1) {
    parts.push(`Sentence number ${i} contains a few words to give it length.`);
  }
  return parts.join(' ');
}

describe('chunkTextSource', () => {
  it('keeps every paragraph segment, not just the first', async () => {
    const raw = [
      'Fixture Title Line',
      '',
      'The Zanzibar Protocol was ratified on 14 March 2019.',
      'It sets the harbour tariff at 4.75 credits per tonne.',
      '',
      'The chief architect was Commissioner Ndlovu-Restrepo.',
    ].join('\n');

    const extraction = await extractFromString({ title: 'notes.txt' } as never, raw);
    expect(extraction.segments.length).toBe(3);

    const chunks = chunkTextSource({
      sourceTitle: 'notes.txt',
      segments: extraction.segments,
    });

    const joined = chunks.map((c) => c.content).join('\n');
    expect(joined).toContain('Zanzibar Protocol');
    expect(joined).toContain('4.75 credits per tonne');
    expect(joined).toContain('Ndlovu-Restrepo');

    for (const segment of extraction.segments) {
      expect(joined).toContain(segment.text.split('\n')[0]);
    }
  });

  it('numbers chunkIndex contiguously across segments', async () => {
    const raw = 'Alpha paragraph.\n\nBravo paragraph.\n\nCharlie paragraph.';
    const extraction = await extractFromString({ title: 'multi.txt' } as never, raw);
    const chunks = chunkTextSource({
      sourceTitle: 'multi.txt',
      segments: extraction.segments,
    });
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
  });

  it('resolves each locator to the verbatim substring of the document', async () => {
    const raw = 'First block here.\n\nSecond block with detail.\n\nThird block.';
    const extraction = await extractFromString({ title: 'loc.txt' } as never, raw);
    const chunks = chunkTextSource({
      sourceTitle: 'loc.txt',
      segments: extraction.segments,
    });
    for (const chunk of chunks) {
      const { startChar, endChar } = chunk.locator as {
        startChar: number;
        endChar: number;
      };
      expect(raw.slice(startChar, endChar)).toBe(chunk.content);
    }
  });

  it('rejects a segment carrying a non-text locator', () => {
    expect(() =>
      chunkTextSource({
        sourceTitle: 'bad.txt',
        segments: [{ text: 'x', locator: { kind: 'pdf_page', page: 1 } }],
      }),
    ).toThrow(/expected text_range/);
  });
});
