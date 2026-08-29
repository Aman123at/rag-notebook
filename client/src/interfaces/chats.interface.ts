/**
 * Chat-domain object shapes used across the SSE stream client and the
 * live-message hook.
 */
import type { Citation, WebCitation } from "@/contract/sse-events";
import type { SendMessageBody, StreamPhase } from "@/types/chats.types";
import type { ErrorCode } from "@/lib/api/types";

export interface OpenChatStreamArgs {
  chatId: string;
  body: SendMessageBody;
  getToken: () => Promise<string | null>;
  signal: AbortSignal;
}

export interface WebSearchState {
  status: "started" | "completed" | "failed";
  query?: string | undefined;
  resultCount?: number | undefined;
  /** Searches left in this chat session after this one. Contract v1.3.0. */
  remainingSearches?: number | undefined;
}

/**
 * The assistant found nothing in the workspace sources and is asking
 * permission to search the public web (contract v1.3.0 `web_search_offer`).
 *
 * The offer text itself streams as ordinary tokens; this is the structured
 * half, so the UI can show a real button instead of making the user type
 * "yes". Accepting re-sends the proposed query with `webSearch: true`.
 */
export interface WebSearchOfferState {
  query: string;
  remainingSearches: number;
}

export interface StreamError {
  code: ErrorCode | "UNKNOWN";
  message: string;
  /** SECURITY_VIOLATION strike; 1 = warning, 2 = blocked. */
  strike?: 1 | 2 | undefined;
  blocked?: boolean | undefined;
  requestId?: string | undefined;
}

export interface LiveMessage {
  userMessageId: string;
  assistantMessageId: string;
  content: string;
  citations: Citation[];
  webCitations: WebCitation[];
  phase: StreamPhase;
  retrievalChunkCount: number | null;
  webSearch: WebSearchState | null;
  webSearchOffer: WebSearchOfferState | null;
  error: StreamError | null;
}
