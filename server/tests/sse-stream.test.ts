import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';
process.env['LOG_LEVEL'] = 'silent';
process.env['APP_URL'] = 'http://localhost:3000';
process.env['CLIENT_ORIGINS'] = 'http://localhost:5173';
process.env['DATABASE_URL'] = 'postgres://postgres:postgres@localhost:5432/rag_notebook';
process.env['CLERK_WEBHOOK_SECRET'] = 'whsec_dGVzdC1zZWNyZXQtZm9yLXVuaXQtdGVzdA==';

const { SseStream } = await import('../src/services/chat/stream.js');
const { encodeSSE } = await import('../src/contract/index.js');

type SseTransport = ConstructorParameters<typeof SseStream>[0];

function fakeTransport(): {
  transport: SseTransport;
  chunks: string[];
  headers: Record<string, string>;
  state: { ended: number; flushed: number; status: number | null };
  fireClose: () => void;
} {
  const chunks: string[] = [];
  const headers: Record<string, string> = {};
  const state = { ended: 0, flushed: 0, status: null as number | null };
  let closeListener: (() => void) | null = null;
  return {
    chunks,
    headers,
    state,
    fireClose: () => closeListener?.(),
    transport: {
      status: (code) => {
        state.status = code;
      },
      setHeader: (name, value) => {
        headers[name] = value;
      },
      flushHeaders: () => {
        state.flushed += 1;
      },
      write: (chunk) => {
        chunks.push(chunk);
      },
      end: () => {
        state.ended += 1;
      },
      onClose: (listener) => {
        closeListener = listener;
      },
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('SseStream', () => {
  it('opens with the SSE headers and flushes them immediately', () => {
    const t = fakeTransport();
    new SseStream(t.transport).open();

    expect(t.state.status).toBe(200);
    expect(t.headers['Content-Type']).toBe('text/event-stream; charset=utf-8');
    expect(t.headers['Cache-Control']).toBe('no-cache, no-transform');
    expect(t.headers['Connection']).toBe('keep-alive');
    expect(t.headers['X-Accel-Buffering']).toBe('no');
    expect(t.state.flushed).toBe(1);
  });

  it('frames events with encodeSSE and never emits [DONE]', () => {
    const t = fakeTransport();
    const s = new SseStream(t.transport);
    const start = {
      type: 'message_start',
      data: {
        userMessageId: crypto.randomUUID(),
        assistantMessageId: crypto.randomUUID(),
        model: 'gpt-4o-mini',
        chatId: crypto.randomUUID(),
      },
    } as const;
    s.open();
    s.emit(start);
    s.emit({ type: 'token', data: { delta: 'hi' } });

    expect(t.chunks).toEqual([
      encodeSSE(start),
      encodeSSE({ type: 'token', data: { delta: 'hi' } }),
    ]);
    expect(t.chunks.join('')).not.toContain('[DONE]');
  });

  it('heartbeats every 15 seconds while open and stops once closed', () => {
    const t = fakeTransport();
    const s = new SseStream(t.transport);
    s.open();

    vi.advanceTimersByTime(15_000);
    vi.advanceTimersByTime(15_000);
    expect(t.chunks.filter((c) => c.includes('heartbeat')).length).toBe(2);

    s.close();
    vi.advanceTimersByTime(60_000);
    expect(t.chunks.filter((c) => c.includes('heartbeat')).length).toBe(2);
  });

  it('drops emits after close and ends the response exactly once', () => {
    const t = fakeTransport();
    const s = new SseStream(t.transport);
    s.open();
    s.close();
    s.close();
    s.emit({ type: 'token', data: { delta: 'late' } });

    expect(t.state.ended).toBe(1);
    expect(t.chunks).toEqual([]);
    expect(s.isClosed).toBe(true);
  });

  it('aborts the signal and runs every close handler exactly once', () => {
    const t = fakeTransport();
    const s = new SseStream(t.transport);
    const first = vi.fn();
    const second = vi.fn();
    s.open();
    s.onClose({ onDisconnect: first });
    s.onClose({ onDisconnect: second });

    expect(s.signal.aborted).toBe(false);
    s.abort();
    s.abort();

    expect(s.signal.aborted).toBe(true);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('runs the close handlers when the client disconnects mid-stream', () => {
    const t = fakeTransport();
    const s = new SseStream(t.transport);
    const onDisconnect = vi.fn();
    s.open();
    s.onClose({ onDisconnect });

    t.fireClose();

    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(s.signal.aborted).toBe(true);
    expect(s.isClosed).toBe(true);
  });

  it('ignores the transport close event once the stream ended itself', () => {
    const t = fakeTransport();
    const s = new SseStream(t.transport);
    const onDisconnect = vi.fn();
    s.open();
    s.onClose({ onDisconnect });

    s.close();
    t.fireClose();

    expect(onDisconnect).not.toHaveBeenCalled();
  });

  it('keeps running when a close handler throws', () => {
    const t = fakeTransport();
    const s = new SseStream(t.transport);
    const good = vi.fn();
    s.open();
    s.onClose({
      onDisconnect: () => {
        throw new Error('boom');
      },
    });
    s.onClose({ onDisconnect: good });

    expect(() => s.abort()).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
  });

  it('marks itself closed when a write fails', () => {
    const t = fakeTransport();
    const s = new SseStream({
      ...t.transport,
      write: () => {
        throw new Error('socket gone');
      },
    });
    s.open();
    s.emit({ type: 'token', data: { delta: 'x' } });

    expect(s.isClosed).toBe(true);
  });
});
