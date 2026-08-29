import { describe, expect, it, vi } from 'vitest';

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';
process.env['LOG_LEVEL'] = 'silent';
process.env['APP_URL'] = 'http://localhost:3000';
process.env['CLIENT_ORIGINS'] = 'http://localhost:5173';
process.env['DATABASE_URL'] = 'postgres://postgres:postgres@localhost:5432/rag_notebook';
process.env['CLOUDINARY_UPLOAD_FOLDER'] = 'rag-notebook';

const uploads = await import('../src/services/source/upload-validation.js');
const urlGuard = await import('../src/services/source/url-guard.js');
const youtubeUrl = await import('../src/services/source/youtube-url.js');
const bus = await import('../src/services/source/events.js');
const { AppError } = await import('../src/errors/AppError.js');

describe('SSRF guard — isBlockedAddress', () => {
  const blocked = [
    '127.0.0.1',
    '127.1.2.3',
    '10.0.0.1',
    '10.255.255.255',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fe80::1',

    'fec0::1',

    'fc00::1',
    'fdff:ffff::1',

    'ff02::1',
    'ff05::1:3',

    'FE80::1',
    'FD00::1',
    '::FFFF:127.0.0.1',

    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    '::ffff:169.254.169.254',
    '::ffff:192.168.1.1',
    '::ffff:172.16.0.1',
  ];
  for (const addr of blocked) {
    it(`blocks ${addr}`, () => {
      expect(urlGuard.isBlockedAddress(addr)).toBe(true);
    });
  }

  const allowed = [
    '1.1.1.1',
    '8.8.8.8',
    '172.15.0.1',
    '172.32.0.1',
    '2001:4860:4860::8888',

    '2606:4700:4700::1111',

    '::ffff:8.8.8.8',
  ];
  for (const addr of allowed) {
    it(`allows ${addr}`, () => {
      expect(urlGuard.isBlockedAddress(addr)).toBe(false);
    });
  }
});

describe('validatePublicHttpUrl', () => {
  it('rejects non-http protocols', async () => {
    await expect(urlGuard.validatePublicHttpUrl('ftp://example.com/foo')).rejects.toBeInstanceOf(
      AppError,
    );
  });
  it('rejects file: URIs', async () => {
    await expect(urlGuard.validatePublicHttpUrl('file:///etc/passwd')).rejects.toBeInstanceOf(
      AppError,
    );
  });
  it('rejects localhost', async () => {
    await expect(urlGuard.validatePublicHttpUrl('http://localhost/api')).rejects.toBeInstanceOf(
      AppError,
    );
  });
  it('rejects literal private IP', async () => {
    await expect(urlGuard.validatePublicHttpUrl('http://127.0.0.1/api')).rejects.toBeInstanceOf(
      AppError,
    );
  });
  it('rejects literal IMDS', async () => {
    await expect(
      urlGuard.validatePublicHttpUrl('http://169.254.169.254/latest/meta-data/'),
    ).rejects.toBeInstanceOf(AppError);
  });
  it('rejects literal 10.x', async () => {
    await expect(urlGuard.validatePublicHttpUrl('http://10.0.0.1/x')).rejects.toBeInstanceOf(
      AppError,
    );
  });
  it('rejects a URL longer than 2048 chars', async () => {
    const long = 'https://example.com/' + 'a'.repeat(2100);
    await expect(urlGuard.validatePublicHttpUrl(long)).rejects.toBeInstanceOf(AppError);
  });
  it('rejects a hostname that resolves to a private IP (DNS-rebinding defence)', async () => {
    const dns = await import('node:dns');
    const spy = vi
      .spyOn(dns.promises, 'lookup')
      .mockResolvedValue([{ address: '10.0.0.1', family: 4 }] as never);
    try {
      await expect(
        urlGuard.validatePublicHttpUrl('http://evil.example.com/x'),
      ).rejects.toBeInstanceOf(AppError);
    } finally {
      spy.mockRestore();
    }
  });
  it('accepts a hostname that resolves to a public IP', async () => {
    const dns = await import('node:dns');
    const spy = vi
      .spyOn(dns.promises, 'lookup')
      .mockResolvedValue([{ address: '1.1.1.1', family: 4 }] as never);
    try {
      const url = await urlGuard.validatePublicHttpUrl('https://example.com/path?q=1');
      expect(url.hostname).toBe('example.com');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('parseYouTubeUrl — table', () => {
  const cases: Array<{
    raw: string;
    expected: 'YOUTUBE_VIDEO' | 'YOUTUBE_PLAYLIST';
    kind: 'video' | 'playlist' | 'reject';
    id?: string;
  }> = [
    {
      raw: 'https://youtu.be/dQw4w9WgXcQ',
      expected: 'YOUTUBE_VIDEO',
      kind: 'video',
      id: 'dQw4w9WgXcQ',
    },
    {
      raw: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      expected: 'YOUTUBE_VIDEO',
      kind: 'video',
      id: 'dQw4w9WgXcQ',
    },
    {
      raw: 'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      expected: 'YOUTUBE_VIDEO',
      kind: 'video',
      id: 'dQw4w9WgXcQ',
    },
    {
      raw: 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      expected: 'YOUTUBE_VIDEO',
      kind: 'video',
      id: 'dQw4w9WgXcQ',
    },
    {
      raw: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      expected: 'YOUTUBE_VIDEO',
      kind: 'video',
      id: 'dQw4w9WgXcQ',
    },
    {
      raw: 'https://www.youtube.com/playlist?list=PLAAAAAAAA1',
      expected: 'YOUTUBE_PLAYLIST',
      kind: 'playlist',
      id: 'PLAAAAAAAA1',
    },

    {
      raw: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLAAAAAAAA1',
      expected: 'YOUTUBE_VIDEO',
      kind: 'video',
      id: 'dQw4w9WgXcQ',
    },
    {
      raw: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLAAAAAAAA1',
      expected: 'YOUTUBE_PLAYLIST',
      kind: 'playlist',
      id: 'PLAAAAAAAA1',
    },

    { raw: 'https://vimeo.com/dQw4w9WgXcQ', expected: 'YOUTUBE_VIDEO', kind: 'reject' },
    { raw: 'https://www.youtube.com/watch?v=short', expected: 'YOUTUBE_VIDEO', kind: 'reject' },
    { raw: 'not a url at all', expected: 'YOUTUBE_VIDEO', kind: 'reject' },
    {
      raw: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      expected: 'YOUTUBE_PLAYLIST',
      kind: 'reject',
    },
  ];
  for (const c of cases) {
    it(`${c.raw} as ${c.expected} → ${c.kind}`, () => {
      if (c.kind === 'reject') {
        expect(() => youtubeUrl.parseYouTubeUrl(c.raw, c.expected)).toThrow(AppError);
        return;
      }
      const ref = youtubeUrl.parseYouTubeUrl(c.raw, c.expected);
      expect(ref.kind).toBe(c.kind);
      const id = ref.kind === 'video' ? ref.videoId : ref.playlistId;
      expect(id).toBe(c.id);
    });
  }
});

describe('assertMimeAndExtensionMatch', () => {
  it('accepts pdf/pdf', () => {
    expect(uploads.assertMimeAndExtensionMatch('foo.pdf', 'application/pdf')).toBe(
      'application/pdf',
    );
  });
  it('accepts vtt/vtt', () => {
    expect(uploads.assertMimeAndExtensionMatch('captions.vtt', 'text/vtt')).toBe('text/vtt');
  });
  it('rejects unsupported mime', () => {
    expect(() => uploads.assertMimeAndExtensionMatch('foo.docx', 'application/msword')).toThrow(
      AppError,
    );
  });
  it('rejects mime/extension mismatch (pdf mime, txt ext)', () => {
    expect(() => uploads.assertMimeAndExtensionMatch('foo.txt', 'application/pdf')).toThrow(
      AppError,
    );
  });
  it('rejects a file with no extension', () => {
    expect(() => uploads.assertMimeAndExtensionMatch('noext', 'application/pdf')).toThrow(AppError);
  });
});

describe('derivePublicId + assertPublicIdBelongsTo', () => {
  it('derives a folder/user/workspace/uuid path', () => {
    const id = uploads.derivePublicId('user-1', 'ws-1');
    expect(id.startsWith('rag-notebook/user-1/ws-1/')).toBe(true);
  });
  it('accepts a publicId under the caller prefix', () => {
    expect(() =>
      uploads.assertPublicIdBelongsTo('rag-notebook/user-1/ws-1/abcd', 'user-1', 'ws-1'),
    ).not.toThrow();
  });
  it("rejects a publicId under someone else's prefix", () => {
    expect(() =>
      uploads.assertPublicIdBelongsTo('rag-notebook/user-2/ws-1/abcd', 'user-1', 'ws-1'),
    ).toThrow(AppError);
  });
  it('rejects a publicId under a different workspace', () => {
    expect(() =>
      uploads.assertPublicIdBelongsTo('rag-notebook/user-1/ws-99/abcd', 'user-1', 'ws-1'),
    ).toThrow(AppError);
  });
});

describe('SSE bus subscribe/publish', () => {
  it('publishes to subscribers on the same channel', () => {
    const received: unknown[] = [];
    const unsub = bus.subscribeToSourceEvents('u1', 'w1', (e) => received.push(e));
    bus.publishSourceEvent('u1', 'w1', {
      type: 'source_status',
      data: {
        sourceId: '00000000-0000-0000-0000-000000000001',
        status: 'READY',
        displayStatus: 'indexed',
        chunkCount: 3,
      },
    });
    unsub();
    expect(received).toHaveLength(1);
  });
  it('does not deliver across users or workspaces', () => {
    const received: unknown[] = [];
    const unsub = bus.subscribeToSourceEvents('u1', 'w1', (e) => received.push(e));
    bus.publishSourceEvent('u2', 'w1', {
      type: 'heartbeat',
      data: { t: 1 },
    });
    bus.publishSourceEvent('u1', 'w2', {
      type: 'heartbeat',
      data: { t: 2 },
    });
    unsub();
    expect(received).toHaveLength(0);
  });
  it('unsubscribe drops the listener count to zero', () => {
    const unsub = bus.subscribeToSourceEvents('u1', 'w1', () => undefined);
    expect(bus._subscriberCountForTest('u1', 'w1')).toBe(1);
    unsub();
    expect(bus._subscriberCountForTest('u1', 'w1')).toBe(0);
  });
});

describe('encodeSourceStreamSSE', () => {
  it('encodes a heartbeat frame', () => {
    const s = bus.encodeSourceStreamSSE({ type: 'heartbeat', data: { t: 42 } });
    expect(s).toBe('event: heartbeat\ndata: {"t":42}\n\n');
  });
  it('encodes a source_status frame', () => {
    const s = bus.encodeSourceStreamSSE({
      type: 'source_status',
      data: {
        sourceId: '00000000-0000-0000-0000-000000000001',
        status: 'READY',
        displayStatus: 'indexed',
        chunkCount: 3,
      },
    });
    expect(s.startsWith('event: source_status\ndata: {')).toBe(true);
    expect(s.endsWith('\n\n')).toBe(true);
  });
});
