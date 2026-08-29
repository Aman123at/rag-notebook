/**
 * Chat-domain type aliases and unions.
 */
import type { GetResult } from "@/lib/api/types";

export type Chat = GetResult<"/workspaces/{workspaceId}/chats">[number];
export type Message = GetResult<"/chats/{chatId}/messages">[number];
export type Citation = Message["citations"][number];
export type WebCitation = Message["webCitations"][number];

export type SendMessageBody = {
  content: string;
  model?: "gpt-4o-mini" | "gpt-4o" | undefined;
  webSearch?: boolean | undefined;
};

export type StreamPhase =
  | "idle"
  | "starting"
  | "retrieving"
  | "web_searching"
  | "streaming"
  | "done"
  | "error";

export type DislikedReason =
  | "INAPPROPRIATE"
  | "HALLUCINATED"
  | "INCOMPLETE"
  | "OFF_TOPIC"
  | "OTHER";

export type ReactionBody =
  | { reaction: "like" }
  | { reaction: null }
  | { reaction: "dislike"; dislikedReason?: DislikedReason; dislikedNote?: string };
