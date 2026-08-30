import { z } from 'zod';

import { ErrorCodeSchema } from '../common/errors.js';
import { CitationSchema, WebCitationSchema } from '../domain/citation.js';
import { ChatModelSchema, FinishReasonSchema } from '../domain/enums.js';


























const MessageStartData = z.object({
  userMessageId: z.string().uuid(),
  assistantMessageId: z.string().uuid(),
  model: ChatModelSchema,
  chatId: z.string().uuid(),
});

const RetrievalData = z.object({
  







  status: z.enum(['started', 'completed', 'failed']),
  chunkCount: z.number().int().nonnegative(),
});

const CitationsData = z.object({
  citations: z.array(CitationSchema),
});

const ToolCallData = z.object({
  tool: z.literal('web_search'),
  status: z.enum(['started', 'completed', 'failed']),
  query: z.string().optional(),
  resultCount: z.number().int().nonnegative().optional(),
  




  remainingSearches: z.number().int().nonnegative().optional(),
});












const WebSearchOfferData = z.object({
  
  query: z.string(),
  
  remainingSearches: z.number().int().nonnegative(),
});

const WebCitationsData = z.object({
  citations: z.array(WebCitationSchema),
});

const TokenData = z.object({
  delta: z.string(),
});

const UsageData = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  
  remainingTokens: z.number().int().nullable(),
});

const MessageEndData = z.object({
  assistantMessageId: z.string().uuid(),
  finishReason: FinishReasonSchema,
});

const ErrorData = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
});

const HeartbeatData = z.object({
  
  t: z.number().int().nonnegative(),
});


export const MessageStartEventSchema = z.object({ type: z.literal('message_start'), data: MessageStartData });
export const RetrievalEventSchema = z.object({ type: z.literal('retrieval'), data: RetrievalData });
export const CitationsEventSchema = z.object({ type: z.literal('citations'), data: CitationsData });
export const ToolCallEventSchema = z.object({ type: z.literal('tool_call'), data: ToolCallData });
export const WebCitationsEventSchema = z.object({ type: z.literal('web_citations'), data: WebCitationsData });
export const WebSearchOfferEventSchema = z.object({ type: z.literal('web_search_offer'), data: WebSearchOfferData });
export const TokenEventSchema = z.object({ type: z.literal('token'), data: TokenData });
export const UsageEventSchema = z.object({ type: z.literal('usage'), data: UsageData });
export const MessageEndEventSchema = z.object({ type: z.literal('message_end'), data: MessageEndData });
export const ErrorEventSchema = z.object({ type: z.literal('error'), data: ErrorData });
export const HeartbeatEventSchema = z.object({ type: z.literal('heartbeat'), data: HeartbeatData });

export const ChatStreamEventSchema = z.discriminatedUnion('type', [
  MessageStartEventSchema,
  RetrievalEventSchema,
  CitationsEventSchema,
  ToolCallEventSchema,
  WebCitationsEventSchema,
  WebSearchOfferEventSchema,
  TokenEventSchema,
  UsageEventSchema,
  MessageEndEventSchema,
  ErrorEventSchema,
  HeartbeatEventSchema,
]);
export type ChatStreamEvent = z.infer<typeof ChatStreamEventSchema>;

export const CHAT_STREAM_EVENT_TYPES = [
  'message_start',
  'retrieval',
  'citations',
  'tool_call',
  'web_citations',
  'web_search_offer',
  'token',
  'usage',
  'message_end',
  'error',
  'heartbeat',
] as const;
export type ChatStreamEventType = (typeof CHAT_STREAM_EVENT_TYPES)[number];














export function encodeSSE(event: ChatStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}
