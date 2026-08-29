/**
 * The shared SSE wire format (ticket 04). Both streams parse frames through
 * this module now; these tests moved here from `stream.test.ts` when the parser
 * did, and gained coverage for `splitFrames` and `readFrames`, which the chat
 * stream could only exercise indirectly.
 */
import { describe, expect, it } from "vitest";
import { parseFrame, readFrames, splitFrames } from "@/lib/api/sse";
import type { SseFrame } from "@/lib/api/sse";

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

async function framesOf(chunks: string[]): Promise<SseFrame[]> {
  const out: SseFrame[] = [];
  for await (const frame of readFrames(streamOf(chunks))) out.push(frame);
  return out;
}

describe("parseFrame", () => {
  it("parses an event name and its JSON payload", () => {
    expect(parseFrame('event: token\ndata: {"delta":"Hi"}')).toEqual({
      type: "token",
      data: { delta: "Hi" },
    });
  });

  it("defaults to the `message` type when the frame names no event", () => {
    expect(parseFrame('data: {"delta":"Hi"}')).toEqual({
      type: "message",
      data: { delta: "Hi" },
    });
  });

  it("yields nothing for a :comment keepalive", () => {
    expect(parseFrame(": keepalive")).toBeNull();
    expect(parseFrame(":")).toBeNull();
  });

  it("parses a payload the server pretty-printed across several data: lines", () => {
    const frame = ["event: token", "data: {", 'data:   "delta": "Hi"', "data: }"].join("\n");
    expect(parseFrame(frame)).toEqual({ type: "token", data: { delta: "Hi" } });
  });

  /**
   * The separator itself, pinned. No fixture parses under `"\n"` and *fails*
   * under `""` — a raw newline is only ever whitespace between JSON tokens —
   * so the discriminating case runs the other way: two lines that split a
   * number in half parse fine when concatenated (`12`) and are malformed once
   * a newline lands between them. Null here means the join is `"\n"`.
   */
  it("joins data: lines with newlines, not by concatenation", () => {
    expect(parseFrame(['data: {"n":1', "data: 2}"].join("\n"))).toBeNull();
  });

  it("returns null rather than throwing on a malformed JSON payload", () => {
    expect(parseFrame("event: token\ndata: {not json")).toBeNull();
  });
});

describe("splitFrames", () => {
  it("returns complete frames and keeps the unterminated tail", () => {
    expect(splitFrames("a\n\nb\n\nc")).toEqual({ frames: ["a", "b"], rest: "c" });
  });

  it("keeps everything when no terminator has arrived", () => {
    expect(splitFrames("event: token\ndata: {")).toEqual({
      frames: [],
      rest: "event: token\ndata: {",
    });
  });
});

describe("readFrames", () => {
  it("reassembles a frame split across chunk boundaries", async () => {
    await expect(framesOf(['event: token\nda', 'ta: {"delta":"Hi"}\n\n'])).resolves.toEqual([
      { type: "token", data: { delta: "Hi" } },
    ]);
  });

  it("skips keepalives and malformed frames without ending the stream", async () => {
    const frames = await framesOf([
      ": keepalive\n\n",
      "event: token\ndata: {broken\n\n",
      'event: token\ndata: {"delta":"Hi"}\n\n',
    ]);
    expect(frames).toEqual([{ type: "token", data: { delta: "Hi" } }]);
  });

  it("drops a trailing frame that never received its blank line", async () => {
    await expect(framesOf(['event: token\ndata: {"delta":"Hi"}'])).resolves.toEqual([]);
  });

  it("reassembles a whole transcript fed one byte at a time", async () => {
    const transcript =
      'event: source_status\ndata: {"sourceId":"src_1","status":"CHUNKING"}\n\n' +
      ': keepalive\n\n' +
      'event: heartbeat\ndata: {"t":1}\n\n';
    await expect(framesOf([...transcript])).resolves.toEqual([
      { type: "source_status", data: { sourceId: "src_1", status: "CHUNKING" } },
      { type: "heartbeat", data: { t: 1 } },
    ]);
  });
});
