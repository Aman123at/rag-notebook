process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';
process.env['LOG_LEVEL'] = 'silent';
process.env['APP_URL'] = 'http://localhost:3000';
process.env['CLIENT_ORIGINS'] = 'http://localhost:5173';
process.env['DATABASE_URL'] = 'postgres://postgres:postgres@localhost:5432/rag_notebook';
process.env['CLOUDINARY_UPLOAD_FOLDER'] = 'rag-notebook';
process.env['INNGEST_DEV'] = '1';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
  transitions: [] as Array<{ status: string; chunkCount?: number }>,
  failure: null as null | { code: string; message: string; retryable: boolean },
  extractCalls: 0,
  extractFailUntil: 0,
  extractTerminal: false,
  loaded: {
    id: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    workspaceId: '33333333-3333-4333-8333-333333333333',
    type: 'PDF' as const,
    title: 'test',
    originalRef: 'test.pdf',
    status: 'UPLOADED' as string,
  },
};

vi.mock('@/inngest/client.js', async () => {
  const { Inngest } = await import('inngest');
  const client = new Inngest({ id: 'rag-notebook-server-test', isDev: true });

  Object.defineProperty(client, 'send', {
    value: vi.fn(() => ({ ids: ['stub'] })),
    writable: true,
  });
  return { inngest: client };
});

vi.mock('@/services/source-processing.service.js', async () => {
  const { throwIngestionError } = await import('@/inngest/errors.js');
  return {
    loadSourceForIngestion: vi.fn(() => ({ ...state.loaded })),
    transitionSourceStatus: vi.fn(
      (_src: unknown, next: string, extras?: { chunkCount?: number }) => {
        state.transitions.push({ status: next, ...(extras ?? {}) });
      },
    ),
    recordSourceFailure: vi.fn(
      (_src: unknown, failure: { code: string; message: string; retryable: boolean }) => {
        state.failure = failure;
      },
    ),
    runExtractionStub: vi.fn(() => {
      state.extractCalls += 1;
      if (state.extractCalls <= state.extractFailUntil) {
        if (state.extractTerminal) {
          throwIngestionError('PDF_ENCRYPTED', 'stubbed terminal failure');
        }
        throw new Error('transient upstream 5xx');
      }
      return { title: 'test', segmentCount: 1 };
    }),
    runSecurityScanStub: vi.fn(() => ({ clean: true })),
    runChunkingStub: vi.fn(() => ({ chunkCount: 1 })),
    runIndexingStub: vi.fn(() => ({ indexed: 0 })),
    stubChunkIdForSource: vi.fn((id: string) => `chunk:${id}`),
  };
});

const { InngestTestEngine } = await import('@inngest/test');
const { handleIngestFailure, ingestSourceFunction } =
  await import('../src/inngest/functions/ingest-source.js');

const SOURCE = state.loaded;
const baseEvent = {
  name: 'source/ingest.requested',
  data: {
    sourceId: SOURCE.id,
    userId: SOURCE.userId,
    workspaceId: SOURCE.workspaceId,
  },
} as const;

beforeEach(() => {
  state.transitions = [];
  state.failure = null;
  state.extractCalls = 0;
  state.extractFailUntil = 0;
  state.extractTerminal = false;
  state.loaded.status = 'UPLOADED';
});

describe('S8 ingest state machine — happy path', () => {
  it('runs every transition in order and lands on READY', async () => {
    const t = new InngestTestEngine({
      function: ingestSourceFunction,
      events: [baseEvent],
    });
    const { result, error } = await t.execute();
    expect(error).toBeUndefined();
    expect(result).toEqual({
      sourceId: SOURCE.id,
      status: 'READY',
      chunkCount: 1,
    });
    expect(state.transitions.map((s) => s.status)).toEqual([
      'EXTRACTING',
      'SCANNING',
      'CHUNKING',
      'CHUNKED',
      'INDEXING',
      'READY',
    ]);
    expect(state.transitions.at(-1)).toEqual({ status: 'READY', chunkCount: 1 });
  });

  it('short-circuits when the source is already READY', async () => {
    state.loaded.status = 'READY';
    const t = new InngestTestEngine({
      function: ingestSourceFunction,
      events: [baseEvent],
    });
    const { result, error } = await t.execute();
    expect(error).toBeUndefined();
    expect(result).toEqual({ skipped: 'already-ready', sourceId: SOURCE.id });
    expect(state.transitions).toEqual([]);
  });
});

describe('S8 ingest state machine — retryable failure retried into success', () => {
  it('rejects on the first attempt, succeeds on the second', async () => {
    state.extractFailUntil = 1;
    const t = new InngestTestEngine({
      function: ingestSourceFunction,
      events: [baseEvent],
    });

    const first = await t.execute();
    expect(first.error).toBeDefined();

    state.transitions = [];
    const second = await t.execute();
    expect(second.error).toBeUndefined();
    expect(second.result).toMatchObject({ status: 'READY', chunkCount: 1 });
    expect(state.extractCalls).toBeGreaterThanOrEqual(2);
    expect(state.failure).toBeNull();
  });
});

describe('S8 ingest state machine — terminal failure', () => {
  it('rejects when a terminal error is thrown from a stage', async () => {
    state.extractFailUntil = 100;
    state.extractTerminal = true;
    const t = new InngestTestEngine({
      function: ingestSourceFunction,
      events: [baseEvent],
    });
    const { error } = await t.execute();
    expect(error).toBeDefined();

    expect(state.transitions.map((s) => s.status)).toEqual(['EXTRACTING']);
  });

  it('handleIngestFailure records the taxonomy code from the wrapped IngestionError', async () => {
    const { throwIngestionError } = await import('../src/inngest/errors.js');
    let caught: unknown;
    try {
      throwIngestionError('PDF_ENCRYPTED', 'encrypted PDF');
    } catch (e) {
      caught = e;
    }
    await handleIngestFailure({
      event: { data: { event: baseEvent } },
      error: caught,
    });
    expect(state.failure).toEqual({
      code: 'PDF_ENCRYPTED',
      message: 'encrypted PDF',
      retryable: false,
    });
  });

  it('handleIngestFailure falls back to INTERNAL_ERROR for opaque failures', async () => {
    await handleIngestFailure({
      event: { data: { event: baseEvent } },
      error: new Error('mystery'),
    });
    expect(state.failure).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'mystery',
      retryable: false,
    });
  });
});
