/**
 * Server-sent events: the wire format, and nothing above it.
 *
 * Both streams in the product — chat tokens and source pipeline status — speak
 * SSE, and both used to carry their own copy of this. The copies had drifted:
 * one skipped `:comment` keepalives and the other did not, one `trimStart`ed a
 * `data:` payload and the other `trim`ed it. A keepalive format the server
 * considers harmless could therefore break one consumer and not the other.
 * This module is the single answer to "what did the server just send".
 *
 * Nothing here knows what an event *means*. Callers own that.
 */

import { env } from "@/lib/env";

/** One parsed SSE frame. `type` is the `event:` name, `data` its JSON payload. */
export interface SseFrame {
  type: string;
  data: unknown;
}

/**
 * Split a buffer at each `\n\n` and return the complete frames plus the
 * trailing partial one, which stays in the buffer until its terminator arrives.
 * Frames split across chunk boundaries are the bug that works perfectly in
 * development and fails in production, so the tail is never guessed at.
 */
export function splitFrames(buffer: string): { frames: string[]; rest: string } {
  const frames: string[] = [];
  let idx = buffer.indexOf("\n\n");
  while (idx !== -1) {
    frames.push(buffer.slice(0, idx));
    buffer = buffer.slice(idx + 2);
    idx = buffer.indexOf("\n\n");
  }
  return { frames, rest: buffer };
}

/**
 * Parse one raw frame. Returns `null` for anything that carries no payload —
 * a `:comment` keepalive, a frame with no `data:` line, or a payload that is
 * not JSON. A malformed frame is skipped, never thrown on: one bad frame must
 * not end a stream that is otherwise healthy.
 */
export function parseFrame(raw: string): SseFrame | null {
  let eventName = "message";
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith(":")) continue;
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  try {
    return { type: eventName, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return null;
  }
}

/**
 * Read a response body to completion, yielding each parsed frame. Ends when the
 * server closes; a trailing frame that never received its blank line is
 * discarded rather than guessed at.
 *
 * Cancelling is the reader's job: abort the signal the request was opened with,
 * or call `.return()` on the iterator, and the read loop unwinds.
 */
export async function* readFrames(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SseFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const split = splitFrames(buffer);
      buffer = split.rest;
      for (const raw of split.frames) {
        const frame = parseFrame(raw);
        if (frame !== null) yield frame;
      }
    }
  } finally {
    reader.cancel().catch(() => {
      // The stream is already gone; nothing to release.
    });
  }
}

/**
 * The request bits both streams share: what we accept, which contract we speak,
 * who we are, and never cache a stream. Chat adds its POST body and content
 * type on top; the status feed adds nothing.
 */
export function sseRequestInit(token: string | null): {
  headers: Record<string, string>;
  cache: RequestCache;
} {
  return {
    headers: {
      Accept: "text/event-stream",
      "X-Contract-Version": env.NEXT_PUBLIC_CONTRACT_VERSION,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  };
}
