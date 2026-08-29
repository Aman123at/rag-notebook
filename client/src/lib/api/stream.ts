/**
 * Chat SSE consumer. Yields a typed `AsyncIterable<ChatStreamEvent>` built from
 * `POST /chats/:chatId/messages`, per CLIENT-PLAN §5. We use `fetch` +
 * `ReadableStream` (not `EventSource`, which cannot POST or set an
 * `Authorization` header).
 *
 * Frame splitting and parsing live in `./sse`, shared with the source-status
 * stream. What is specific to chat, and stays here: the POST, the typed
 * `ApiError` on a failed start, and applying the vendored event union to the
 * parsed payload.
 */
import type { ChatStreamEvent } from "@/contract/sse-events";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/api/errors";
import { generateRequestId } from "@/lib/utils";
import { readFrames, sseRequestInit } from "./sse";
import { isAbort } from "./abort";
import type { OpenChatStreamArgs } from "@/interfaces/chats.interface";

export type { SendMessageBody } from "@/types/chats.types";
export type { OpenChatStreamArgs } from "@/interfaces/chats.interface";

/**
 * Open a chat SSE stream. Returns an `AsyncIterable<ChatStreamEvent>`. The
 * consumer must fully iterate to completion, or abort the passed signal to
 * close the stream (this is what releases the server's token reservation).
 */
export function openChatStream(args: OpenChatStreamArgs): AsyncIterable<ChatStreamEvent> {
  return { [Symbol.asyncIterator]: () => iterate(args) };
}

async function* iterate(args: OpenChatStreamArgs): AsyncGenerator<ChatStreamEvent> {
  const requestId = generateRequestId();
  let res: Response;
  try {
    const shared = sseRequestInit(await args.getToken());
    res = await fetch(`${env.NEXT_PUBLIC_API_URL}/chats/${args.chatId}/messages`, {
      ...shared,
      method: "POST",
      headers: {
        ...shared.headers,
        "Content-Type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify(args.body),
      signal: args.signal,
    });
  } catch (cause) {
    // An abort is the caller closing the stream, not a failure to report.
    if (isAbort(cause)) return;
    throw ApiError.network(cause, requestId);
  }

  if (!res.ok || res.body === null) {
    let payload: unknown = undefined;
    try {
      payload = await res.json();
    } catch {
      // non-JSON error body
    }
    throw ApiError.fromEnvelope(payload, res.status, res.headers.get("x-request-id") ?? requestId);
  }

  try {
    for await (const frame of readFrames(res.body)) {
      // The vendored union describes what this endpoint emits; applying it to
      // the parsed payload is the cast CLAUDE.md §3 allows inside src/lib/api.
      yield { type: frame.type, data: frame.data } as ChatStreamEvent;
    }
  } catch (cause) {
    if (isAbort(cause)) return;
    throw ApiError.network(cause, requestId);
  }
}
