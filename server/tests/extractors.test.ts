process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';
process.env['LOG_LEVEL'] = 'silent';
process.env['APP_URL'] = 'http://localhost:3000';
process.env['CLIENT_ORIGINS'] = 'http://localhost:5173';
process.env['DATABASE_URL'] = 'postgres://postgres:postgres@localhost:5432/rag_notebook';
process.env['CLOUDINARY_UPLOAD_FOLDER'] = 'rag-notebook';
process.env['FIRECRAWL_API_KEY'] = 'test-key';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (p: string) => path.join(here, 'fixtures', p);

async function failureCodeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    const inner = err as { failureCode?: string; cause?: { failureCode?: string } };
    return inner.failureCode ?? inner.cause?.failureCode;
  }
}

const baseSource = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  workspaceId: '33333333-3333-4333-8333-333333333333',
  title: 'Fixture',
  originalRef: 'fixture',
} as const;

describe('TEXT extractor', () => {
  it('splits paragraphs and records text_range locators', async () => {
    const { extractFromString } = await import('@/ingestion/extractors/text.js');
    const src = { ...baseSource, type: 'TEXT' as const };
    const raw = '﻿Hello world.\r\n\r\nSecond paragraph.\n\nThird para.';
    const result = await extractFromString(src, raw);
    expect(result.segments).toHaveLength(3);
    expect(result.segments[0]?.text).toBe('Hello world.');
    expect(result.segments[0]?.locator).toEqual({
      kind: 'text_range',
      startChar: 0,
      endChar: 12,
    });
    expect(result.segments[1]?.text).toBe('Second paragraph.');
    expect(result.segments[2]?.text).toBe('Third para.');
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.metadata['paragraphCount']).toBe(3);
  });

  it('throws PARSE_FAILURE on whitespace-only', async () => {
    const { extractFromString } = await import('@/ingestion/extractors/text.js');
    const src = { ...baseSource, type: 'TEXT' as const };
    expect(await failureCodeOf(extractFromString(src, '   \n\n\n'))).toBe('PARSE_FAILURE');
  });
});

describe('VTT parser', () => {
  it('parses hh:mm:ss.mmm and mm:ss.mmm timestamps', async () => {
    const { parseVttTimestamp } = await import('@/ingestion/extractors/vtt.js');
    expect(parseVttTimestamp('00:00.000')).toBe(0);
    expect(parseVttTimestamp('01:02.500')).toBe(62500);
    expect(parseVttTimestamp('01:00:00.000')).toBe(3_600_000);
    expect(parseVttTimestamp('99:59:59.999')).toBe(359_999_999);
  });

  it('rejects malformed timestamps', async () => {
    const { parseVttTimestamp } = await import('@/ingestion/extractors/vtt.js');
    expect(() => parseVttTimestamp('99:99.999')).toThrow(/PARSE_FAILURE|Out-of-range/);
    expect(() => parseVttTimestamp('00:00,000')).toThrow();
    expect(() => parseVttTimestamp('nope')).toThrow();
  });

  it('strips voice tags and styling tags, captures speaker', async () => {
    const { stripVttMarkup } = await import('@/ingestion/extractors/vtt.js');
    const { text, speaker } = stripVttMarkup(
      '<v Alice>Hi <c.emphasis>everyone</c>!</v> <i>italics</i>',
    );
    expect(speaker).toBe('Alice');
    expect(text).toBe('Hi everyone! italics');
  });

  it('strips inline timestamp cue markers', async () => {
    const { stripVttMarkup } = await import('@/ingestion/extractors/vtt.js');
    const { text } = stripVttMarkup('foo <00:06.000>bar<00:06.500> baz');
    expect(text).toBe('foo bar baz');
  });

  it('extracts every-quirk fixture with correct segment count and locators', async () => {
    const { extractVttFromString } = await import('@/ingestion/extractors/vtt.js');
    const raw = await readFile(fixture('vtt/every-quirk.vtt'), 'utf8');
    const src = { ...baseSource, type: 'VTT' as const };
    const result = extractVttFromString(src, raw);

    expect(result.segments).toHaveLength(4);
    expect(result.segments[0]?.text).toBe('Hello, world.');
    expect(result.segments[0]?.locator).toEqual({
      kind: 'timestamp',
      startMs: 0,
      endMs: 2500,
    });
    expect(result.segments[1]?.text).toBe('Hi everyone!');
    expect(result.segments[1]?.metadata?.['speaker']).toBe('Alice');
    expect(result.segments[2]?.locator).toMatchObject({ kind: 'timestamp' });
    expect(result.segments[2]?.text).toContain('Multi');
    expect(result.segments[2]?.text).toContain('timestamp');
    expect(result.segments[2]?.metadata?.['speaker']).toBe('Bob');
    expect(result.segments[3]?.locator).toEqual({
      kind: 'timestamp',
      startMs: 3_600_000,
      endMs: 3_603_000,
    });
    expect(result.metadata['cueCount']).toBe(4);
    expect((result.metadata['speakers'] as string[]).sort()).toEqual(['Alice', 'Bob']);
  });

  it('rejects a file missing the WEBVTT header', async () => {
    const { extractVttFromString } = await import('@/ingestion/extractors/vtt.js');
    const src = { ...baseSource, type: 'VTT' as const };
    const result = (() => {
      try {
        return Promise.resolve(extractVttFromString(src, '00:00.000 --> 00:01.000\nHi\n'));
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        return Promise.reject(err);
      }
    })();
    expect(await failureCodeOf(result)).toBe(
      'PARSE_FAILURE',
    );
  });

  it('rejects a cue whose end precedes start', async () => {
    const { extractVttFromString } = await import('@/ingestion/extractors/vtt.js');
    const src = { ...baseSource, type: 'VTT' as const };
    const result = (() => {
      try {
        return Promise.resolve(extractVttFromString(src, 'WEBVTT\n\n00:05.000 --> 00:02.000\nnope\n'));
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        return Promise.reject(err);
      }
    })();
    expect(
      await failureCodeOf(result),
    ).toBe('PARSE_FAILURE');
  });
});

vi.mock('unpdf', () => {
  const state = {
    pages: [] as string[],
    throwOnOpen: null as null | Error,
    meta: { Title: 'PDF Meta Title', Author: 'A. Author' } as Record<string, string>,
  };
  return {
    __esModule: true,
    __state: state,
    getDocumentProxy: vi.fn(() => {
      if (state.throwOnOpen) return Promise.reject(state.throwOnOpen);
      return Promise.resolve({
        numPages: state.pages.length,
        getPage: (n: number) =>
          Promise.resolve({
            getTextContent: () =>
              Promise.resolve({ items: [{ str: state.pages[n - 1] ?? '', hasEOL: true }] }),
            cleanup: () => {},
          }),
      });
    }),
    getMeta: vi.fn(() => Promise.resolve({ info: state.meta, metadata: {} })),
  };
});

describe('PDF extractor', () => {
  let mod: {
    __state: { pages: string[]; throwOnOpen: Error | null; meta: Record<string, string> };
  };
  beforeEach(async () => {
    mod = (await import('unpdf')) as never;
    mod.__state.pages = [];
    mod.__state.throwOnOpen = null;
    mod.__state.meta = { Title: 'PDF Meta Title', Author: 'A. Author' };
  });

  it('emits one segment per page with pdf_page locators', async () => {
    const { extractPdfFromBytes } = await import('@/ingestion/extractors/pdf.js');
    mod.__state.pages = [
      'Page one content — introduction and overview.',
      'Page two — main body of the argument.',
      'Page three — conclusion.',
    ];
    const src = { ...baseSource, type: 'PDF' as const };
    const result = await extractPdfFromBytes(src, new Uint8Array([1, 2, 3]));
    expect(result.segments).toHaveLength(3);
    expect(result.segments[0]?.locator).toEqual({ kind: 'pdf_page', page: 1 });
    expect(result.segments[2]?.locator).toEqual({ kind: 'pdf_page', page: 3 });
    expect(result.title).toBe('PDF Meta Title');
    expect(result.metadata['pageCount']).toBe(3);
  });

  it('detects encrypted PDFs as PDF_ENCRYPTED (terminal)', async () => {
    const { extractPdfFromBytes } = await import('@/ingestion/extractors/pdf.js');
    const err = new Error('No password given');
    err.name = 'PasswordException';
    mod.__state.throwOnOpen = err;
    const src = { ...baseSource, type: 'PDF' as const };
    expect(await failureCodeOf(extractPdfFromBytes(src, new Uint8Array([1])))).toBe(
      'PDF_ENCRYPTED',
    );
  });

  it('detects a scanned/zero-text PDF as PDF_NO_TEXT_LAYER', async () => {
    const { extractPdfFromBytes } = await import('@/ingestion/extractors/pdf.js');
    mod.__state.pages = ['', '', '', ''];
    const src = { ...baseSource, type: 'PDF' as const };
    expect(await failureCodeOf(extractPdfFromBytes(src, new Uint8Array([1])))).toBe(
      'PDF_NO_TEXT_LAYER',
    );
  });

  it('handles a 500-page document without loading every page string into one buffer', async () => {
    const { extractPdfFromBytes } = await import('@/ingestion/extractors/pdf.js');

    mod.__state.pages = Array.from({ length: 500 }, (_, i) => `Page ${i + 1} body text.`);
    const src = { ...baseSource, type: 'PDF' as const };
    const result = await extractPdfFromBytes(src, new Uint8Array([1]));
    expect(result.segments).toHaveLength(500);
    expect(result.segments[499]?.locator).toEqual({ kind: 'pdf_page', page: 500 });
    expect(result.metadata['pageCount']).toBe(500);
  });
});

vi.mock('@/integrations/firecrawl.js', () => {
  const state = {
    result: null as null | {
      markdown: string;
      title: string | null;
      description: string | null;
      language: string | null;
      finalUrl: string;
      scrapedAt: string;
    },
    error: null as null | Error,
  };
  return {
    __esModule: true,
    __state: state,
    scrapeUrlAsMarkdown: vi.fn(() => {
      if (state.error) return Promise.reject(state.error);
      if (!state.result) return Promise.reject(new Error('firecrawl mock not primed'));
      return Promise.resolve(state.result);
    }),
    __setFirecrawlClientForTests: () => {},
  };
});

describe('WEB_URL extractor', () => {
  let mod: {
    __state: {
      result: null | {
        markdown: string;
        title: string | null;
        description: string | null;
        language: string | null;
        finalUrl: string;
        scrapedAt: string;
      };
      error: null | Error;
    };
  };
  beforeEach(async () => {
    mod = (await import('@/integrations/firecrawl.js')) as never;
    mod.__state.error = null;
    const raw = JSON.parse(await readFile(fixture('web/example-scrape.json'), 'utf8')) as {
      markdown: string;
      metadata: { title: string; language: string; url: string; description: string };
    };
    mod.__state.result = {
      markdown: raw.markdown,
      title: raw.metadata.title,
      description: raw.metadata.description,
      language: raw.metadata.language,
      finalUrl: raw.metadata.url,
      scrapedAt: '2026-08-25T00:00:00.000Z',
    };
  });

  it('splits scraped markdown on headings', async () => {
    const { webExtractor } = await import('@/ingestion/extractors/web.js');
    const src = { ...baseSource, type: 'WEB_URL' as const, originalRef: 'https://example.com/' };
    const result = await webExtractor.extract(src);
    expect(result.title).toBe('Example Domain');
    expect(result.segments.length).toBeGreaterThanOrEqual(3);
    const sections = result.segments.map((s) => (s.locator as { section?: string }).section);
    expect(sections).toContain('Example Domain');
    expect(sections).toContain('More information');
    expect(sections).toContain('Contact');
    expect(result.metadata['scrapedAt']).toBe('2026-08-25T00:00:00.000Z');
    expect(result.metadata['finalUrl']).toBe('https://example.com/');
  });

  it('surfaces UPSTREAM_5XX as retryable', async () => {
    const { webExtractor } = await import('@/ingestion/extractors/web.js');
    class FakeIngestionError extends Error {
      failureCode = 'UPSTREAM_5XX';
      failureRetryable = true;
    }
    mod.__state.error = new FakeIngestionError('upstream');
    const src = { ...baseSource, type: 'WEB_URL' as const };
    await expect(webExtractor.extract(src)).rejects.toMatchObject({
      failureCode: 'UPSTREAM_5XX',
    });
  });
});

vi.mock('@/integrations/youtube.js', () => {
  const state = {
    video: null as null | {
      videoId: string;
      title: string;
      channelId: string | null;
      channelName: string | null;
      durationSec: number | null;
      transcriptLanguage: string | null;
      transcriptAutoGenerated: boolean | null;
      cues: Array<{ startMs: number; endMs: number; text: string }>;
    },
    playlist: null as null | {
      playlistId: string;
      title: string;
      channelName: string | null;
      totalItems: number;
      items: Array<{ videoId: string; title: string; durationSec: number | null }>;
    },
    videoError: null as null | Error,
    playlistError: null as null | Error,
  };
  return {
    __esModule: true,
    __state: state,
    fetchYouTubeVideo: vi.fn(() => {
      if (state.videoError) return Promise.reject(state.videoError);
      if (!state.video) return Promise.reject(new Error('yt video mock not primed'));
      return Promise.resolve(state.video);
    }),
    fetchYouTubePlaylist: vi.fn(() => {
      if (state.playlistError) return Promise.reject(state.playlistError);
      if (!state.playlist) return Promise.reject(new Error('yt playlist mock not primed'));
      return Promise.resolve(state.playlist);
    }),
    __setYouTubeClientForTests: () => {},
  };
});

describe('YOUTUBE_VIDEO extractor', () => {
  it('maps transcript cues to timestamp locators with videoId', async () => {
    const mod = (await import('@/integrations/youtube.js')) as never as {
      __state: { video: unknown; videoError: null | Error };
    };
    const fx = JSON.parse(await readFile(fixture('youtube/transcript.json'), 'utf8')) as never;
    mod.__state.video = fx;
    mod.__state.videoError = null;
    const { youtubeExtractor } = await import('@/ingestion/extractors/youtube.js');
    const src = {
      ...baseSource,
      type: 'YOUTUBE_VIDEO' as const,
      mediaId: 'dQw4w9WgXcQ',
      originalRef: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    };
    const result = await youtubeExtractor.extract(src);
    expect(result.title).toBe('Fixture Video Title');
    expect(result.segments).toHaveLength(3);
    expect(result.segments[0]?.locator).toEqual({
      kind: 'timestamp',
      startMs: 0,
      endMs: 2500,
      videoId: 'dQw4w9WgXcQ',
    });
    expect(result.metadata['transcriptAutoGenerated']).toBe(true);
    expect(result.metadata['transcriptLanguage']).toBe('en');
  });

  it('resolves valid video ids from YouTube URL forms', async () => {
    const mod = (await import('@/integrations/youtube.js')) as never as {
      __state: { video: unknown; videoError: null | Error };
    };
    const fx = JSON.parse(await readFile(fixture('youtube/transcript.json'), 'utf8')) as never;
    mod.__state.video = fx;
    mod.__state.videoError = null;
    const { youtubeExtractor } = await import('@/ingestion/extractors/youtube.js');

    for (const originalRef of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    ]) {
      const result = await youtubeExtractor.extract({
        ...baseSource,
        type: 'YOUTUBE_VIDEO' as const,
        mediaId: null,
        originalRef,
      });

      expect(result.metadata.videoId).toBe('dQw4w9WgXcQ');
    }
  });
});
