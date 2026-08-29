/**
 * Characterization tests for the SSE reader (ticket 01).
 *
 * Frame splitting and parsing moved to `@/lib/api/sse` and are tested in
 * `sse.test.ts`; what stays here is what chat itself owns — the POST, the
 * typed `ApiError` on a failed start, abort handling, and the events reaching
 * the consumer in order through a body split at awkward boundaries.
 * Stubbing `fetch` is the exception CLIENT-PLAN §9.1 does not cover: the
 * transport itself is the subject here (see the header of `client.test.ts`).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatStreamEvent } from "@/contract/sse-events";
import { openChatStream } from "@/lib/api/stream";

/** A response body that emits exactly these chunks, in order. */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function stubStream(chunks: string[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(streamOf(chunks), {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
    ),
  );
}

/** Iterate a stream to completion against whatever `fetch` is currently stubbed. */
async function drain(): Promise<ChatStreamEvent[]> {
  const events: ChatStreamEvent[] = [];
  const stream = openChatStream({
    chatId: "chat_1",
    body: { content: "hello" },
    getToken: async () => "test-token",
    signal: new AbortController().signal,
  });
  for await (const event of stream) events.push(event);
  return events;
}

/** Stub a body made of these chunks, then iterate it to completion. */
async function collect(chunks: string[]): Promise<ChatStreamEvent[]> {
  stubStream(chunks);
  return drain();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("openChatStream frame assembly", () => {
  it("reassembles a frame that split across two chunk boundaries", async () => {
    const events = await collect(['event: token\nda', 'ta: {"delta":"Hi"}\n\n']);
    expect(events).toEqual([{ type: "token", data: { delta: "Hi" } }]);
  });

  it("reassembles when the split lands inside the blank-line terminator", async () => {
    const events = await collect(['event: token\ndata: {"delta":"Hi"}\n', '\n']);
    expect(events).toEqual([{ type: "token", data: { delta: "Hi" } }]);
  });

  it("yields several frames arriving in one chunk, in order", async () => {
    const events = await collect([
      'event: message_start\ndata: {"userMessageId":"m1","assistantMessageId":"m2","model":"gpt-4o-mini","chatId":"chat_1"}\n\n' +
        'event: token\ndata: {"delta":"He"}\n\n' +
        'event: token\ndata: {"delta":"llo"}\n\n' +
        'event: message_end\ndata: {"assistantMessageId":"m2","finishReason":"stop"}\n\n',
    ]);
    expect(events.map((e) => e.type)).toEqual([
      "message_start",
      "token",
      "token",
      "message_end",
    ]);
  });

  it("skips keepalives and malformed frames without ending the stream", async () => {
    const events = await collect([
      ": keepalive\n\n",
      "event: token\ndata: {broken\n\n",
      'event: token\ndata: {"delta":"Hi"}\n\n',
    ]);
    expect(events).toEqual([{ type: "token", data: { delta: "Hi" } }]);
  });

  it("drops a trailing frame that never received its blank line", async () => {
    const events = await collect(['event: token\ndata: {"delta":"Hi"}']);
    expect(events).toEqual([]);
  });
});

/**
 * CLIENT-PLAN §9.2 #1: "feed the decoder one byte at a time and assert frames
 * reassemble correctly. Frame splitting is the bug that works perfectly in
 * development and fails in production."
 */
describe("openChatStream byte-by-byte", () => {
  const transcript =
    'event: message_start\ndata: {"userMessageId":"m1","assistantMessageId":"m2","model":"gpt-4o-mini","chatId":"chat_1"}\n\n' +
    'event: retrieval\ndata: {"status":"completed","chunkCount":4}\n\n' +
    ': keepalive\n\n' +
    'event: token\ndata: {"delta":"He"}\n\n' +
    'event: token\ndata: {"delta":"llo"}\n\n' +
    'event: message_end\ndata: {"assistantMessageId":"m2","finishReason":"stop"}\n\n';

  it("reassembles the whole transcript when every byte arrives in its own chunk", async () => {
    const events = await collect([...transcript]);
    expect(events).toEqual([
      {
        type: "message_start",
        data: {
          userMessageId: "m1",
          assistantMessageId: "m2",
          model: "gpt-4o-mini",
          chatId: "chat_1",
        },
      },
      { type: "retrieval", data: { status: "completed", chunkCount: 4 } },
      { type: "token", data: { delta: "He" } },
      { type: "token", data: { delta: "llo" } },
      { type: "message_end", data: { assistantMessageId: "m2", finishReason: "stop" } },
    ]);
  });

  it("produces the same events at every possible two-chunk split point", async () => {
    const whole = await collect([transcript]);
    for (let cut = 1; cut < transcript.length; cut += 1) {
      const split = await collect([transcript.slice(0, cut), transcript.slice(cut)]);
      expect(split, `split at byte ${cut}`).toEqual(whole);
    }
  });
});

describe("openChatStream failure paths", () => {
  it("throws a typed ApiError when the stream request itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: "TOKEN_QUOTA_EXCEEDED", message: "Out of tokens.", requestId: "req_1" },
            }),
            { status: 402, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    await expect(drain()).rejects.toMatchObject({
      name: "ApiError",
      code: "TOKEN_QUOTA_EXCEEDED",
      status: 402,
      requestId: "req_1",
    });
  });

  it("maps a non-JSON failure body to UNKNOWN with the header request id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<html>bad gateway</html>", {
            status: 502,
            headers: { "x-request-id": "req_gateway" },
          }),
      ),
    );
    await expect(drain()).rejects.toMatchObject({
      name: "ApiError",
      code: "UNKNOWN",
      status: 502,
      requestId: "req_gateway",
    });
  });

  it("ends the stream quietly when the caller aborts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The user aborted a request.", "AbortError");
      }),
    );
    await expect(drain()).resolves.toEqual([]);
  });
});
