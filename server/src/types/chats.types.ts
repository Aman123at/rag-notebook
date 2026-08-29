import type { Chat, ChatModel } from '@/contract/index.js';

export interface ListChatsResult {
  items: Chat[];
  total: number;
}

export interface RunChatTurnInput {
  userId: string;
  chatId: string;
  content: string;
  webSearch: boolean;
  model?: ChatModel | undefined;
}

export interface ChatContextExtras {
  memories: readonly string[];
  summary: string | null;
}

export interface SummarisationResult {
  chatId: string;
  updated: boolean;
  reason?: string;
  tokensConsumed?: number;
}

export interface StreamCloseHandler {
  onDisconnect(): void;
}

export type DisconnectReason = 'client_closed' | 'server_ended';

export interface SseTransport {
  status(code: number): void;

  setHeader(name: string, value: string): void;

  flushHeaders(): void;

  write(chunk: string): void;

  end(): void;

  onClose(listener: () => void): void;
}
