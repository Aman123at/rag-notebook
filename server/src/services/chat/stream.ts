import { type ChatStreamEvent, encodeSSE } from '@/contract/index.js';
import { logger } from '@/observability/logger.js';
import type { SseTransport, StreamCloseHandler } from '@/types/chats.types.js';

const HEARTBEAT_INTERVAL_MS = 15_000;

export class SseStream {
  private readonly res: SseTransport;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private closed = false;
  private disconnectHandlers: StreamCloseHandler[] = [];
  private readonly abortController: AbortController;

  constructor(res: SseTransport) {
    this.res = res;
    this.abortController = new AbortController();
  }

  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  open(): void {
    this.res.status(200);
    this.res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    this.res.setHeader('Cache-Control', 'no-cache, no-transform');
    this.res.setHeader('Connection', 'keep-alive');
    this.res.setHeader('X-Accel-Buffering', 'no');
    this.res.flushHeaders();

    this.heartbeatTimer = setInterval(() => {
      if (this.closed) return;
      this.write({ type: 'heartbeat', data: { t: Date.now() } });
    }, HEARTBEAT_INTERVAL_MS);
    this.heartbeatTimer.unref();

    this.res.onClose(() => {
      if (this.closed) return;
      logger.info({ event: 'sse.client_disconnect' }, 'Chat SSE client disconnected mid-stream');
      this.abort();
    });
  }

  onClose(handler: StreamCloseHandler): void {
    this.disconnectHandlers.push(handler);
  }

  emit(event: ChatStreamEvent): void {
    if (this.closed) return;
    this.write(event);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    try {
      this.res.end();
    } catch {
      // Ignore errors
    }
  }

  abort(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    try {
      this.abortController.abort();
    } catch {
      // Ignore errors
    }
    for (const h of this.disconnectHandlers) {
      try {
        h.onDisconnect();
      } catch (err) {
        logger.warn(
          {
            event: 'sse.disconnect_handler_failed',
            err: err instanceof Error ? err.message : String(err),
          },
          'SSE disconnect handler threw — swallowed',
        );
      }
    }
    try {
      this.res.end();
    } catch {
      // Ignore errors
    }
  }

  private write(event: ChatStreamEvent): void {
    try {
      this.res.write(encodeSSE(event));
    } catch (err) {
      logger.debug(
        {
          event: 'sse.write_failed',
          err: err instanceof Error ? err.message : String(err),
        },
        'SSE write failed — marking stream closed',
      );
      this.closed = true;
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
    }
  }
}
