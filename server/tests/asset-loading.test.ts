process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';
process.env['LOG_LEVEL'] = 'silent';
process.env['APP_URL'] = 'http://localhost:3000';
process.env['CLIENT_ORIGINS'] = 'http://localhost:5173';
process.env['DATABASE_URL'] = 'postgres://postgres:postgres@localhost:5432/rag_notebook';
process.env['CLOUDINARY_UPLOAD_FOLDER'] = 'rag-notebook';

import { beforeEach, describe, expect, it, vi } from 'vitest';

async function failureCodeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    const inner = err as { failureCode?: string; cause?: { failureCode?: string } };
    return inner.failureCode ?? inner.cause?.failureCode;
  }
}

const state = {
  bytes: new Uint8Array(),
  error: null as null | Error,
  lastCall: null as null | { publicId: string; opts: { maxBytes?: number } | undefined },
};

vi.mock('@/integrations/cloudinary.js', () => ({
  __esModule: true,
  downloadAssetBytes: vi.fn((publicId: string, opts?: { maxBytes?: number }) => {
    state.lastCall = { publicId, opts };
    if (state.error) return Promise.reject(state.error);
    return Promise.resolve(state.bytes);
  }),
}));

const baseSource = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  workspaceId: '33333333-3333-4333-8333-333333333333',
  title: 'Fixture',
  originalRef: 'fixture.pdf',
  storagePublicId: 'rag-notebook/u/w/asset',
} as const;

describe('loadExtractorInput', () => {
  beforeEach(() => {
    state.bytes = new Uint8Array();
    state.error = null;
    state.lastCall = null;
  });

  it('attaches downloaded bytes for PDF sources', async () => {
    const { loadExtractorInput } = await import('@/ingestion/extractors/load.js');
    state.bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const loaded = await loadExtractorInput({ ...baseSource, type: 'PDF' });
    expect((loaded as { bytes?: Uint8Array }).bytes).toEqual(state.bytes);
    expect(state.lastCall?.publicId).toBe(baseSource.storagePublicId);
  });

  it('decodes bytes to a UTF-8 string for TEXT and VTT sources', async () => {
    const { loadExtractorInput } = await import('@/ingestion/extractors/load.js');
    state.bytes = new TextEncoder().encode('héllo\n\nworld');
    for (const type of ['TEXT', 'VTT'] as const) {
      const loaded = await loadExtractorInput({ ...baseSource, type });
      expect((loaded as { content?: string }).content).toBe('héllo\n\nworld');
    }
  });

  it('passes the declared sizeBytes down as the download ceiling', async () => {
    const { loadExtractorInput } = await import('@/ingestion/extractors/load.js');
    state.bytes = new Uint8Array([1, 2, 3]);
    await loadExtractorInput({ ...baseSource, type: 'PDF', sizeBytes: 4096n });
    expect(state.lastCall?.opts).toEqual({ maxBytes: 4096 });
  });

  it('leaves self-fetching source types untouched', async () => {
    const { loadExtractorInput } = await import('@/ingestion/extractors/load.js');
    const src = { ...baseSource, type: 'WEB_URL' as const, originalRef: 'https://example.com' };
    expect(await loadExtractorInput(src)).toBe(src);
    expect(state.lastCall).toBeNull();
  });

  it('fails EXTRACTION_FAILED when a file-backed row has no storagePublicId', async () => {
    const { loadExtractorInput } = await import('@/ingestion/extractors/load.js');
    const src = { ...baseSource, type: 'PDF' as const, storagePublicId: undefined };
    expect(await failureCodeOf(loadExtractorInput(src))).toBe('EXTRACTION_FAILED');
  });

  it('fails UNSUPPORTED_CONTENT when a text asset is not valid UTF-8', async () => {
    const { loadExtractorInput } = await import('@/ingestion/extractors/load.js');
    state.bytes = new Uint8Array([0xff, 0xfe, 0x00, 0x80]);
    expect(await failureCodeOf(loadExtractorInput({ ...baseSource, type: 'TEXT' }))).toBe(
      'UNSUPPORTED_CONTENT',
    );
  });

  it('propagates download failures unchanged', async () => {
    const { loadExtractorInput } = await import('@/ingestion/extractors/load.js');
    state.error = Object.assign(new Error('boom'), { failureCode: 'NETWORK_ERROR' });
    expect(await failureCodeOf(loadExtractorInput({ ...baseSource, type: 'PDF' }))).toBe(
      'NETWORK_ERROR',
    );
  });
});
