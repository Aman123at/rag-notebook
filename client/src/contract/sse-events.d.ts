/**
 * AUTO-GENERATED FROM src/contract/. Do not edit manually.
 * Regenerate with: pnpm contract:build
 */

/**
 * Chat SSE event stream. Wire format for each event:
 *   event: <type>\n
 *   data:  <json>\n
 */

export type ChatModel = 'gpt-4o-mini' | 'gpt-4o';
export type FinishReason = 'stop' | 'length' | 'tool' | 'aborted';

export interface Citation {
  index: number;
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  sourceType: 'PDF' | 'TEXT' | 'VTT' | 'WEB_URL' | 'YOUTUBE_VIDEO' | 'YOUTUBE_PLAYLIST';
  locator:
    | { kind: 'pdf_page'; page: number }
    | { kind: 'timestamp'; startMs: number; endMs: number; videoId?: string }
    | { kind: 'text_range'; startChar: number; endChar: number }
    | { kind: 'web'; url: string; section?: string };
  snippet: string;
  score: number;
  deepLink?: string;
}

export interface WebCitation {
  index: number;
  url: string;
  title: string;
  snippet: string;
}

export type ChatStreamEvent =
  | { type: 'message_start'; data: { userMessageId: string; assistantMessageId: string; model: ChatModel; chatId: string } }
  | { type: 'retrieval'; data: { status: 'started' | 'completed' | 'failed'; chunkCount: number } }
  | { type: 'citations'; data: { citations: Citation[] } }
  | { type: 'tool_call'; data: { tool: 'web_search'; status: 'started' | 'completed' | 'failed'; query?: string; resultCount?: number; remainingSearches?: number } }
  | { type: 'web_citations'; data: { citations: WebCitation[] } }
  | { type: 'web_search_offer'; data: { query: string; remainingSearches: number } }
  | { type: 'token'; data: { delta: string } }
  | {
      type: 'usage';
      data: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        remainingTokens: number | null;
      };
    }
  | { type: 'message_end'; data: { assistantMessageId: string; finishReason: FinishReason } }
  | { type: 'error'; data: { code: string; message: string; details?: unknown } }
  | { type: 'heartbeat'; data: { t: number } };
