"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { openChatStream } from "@/lib/api/stream";
import { messagesQueryKey, type Message } from "@/hooks/use-messages";
import { ME_QUERY_KEY } from "@/hooks/use-current-user";
import { ApiError, isApiError } from "@/lib/api/errors";
import type { ErrorCode } from "@/lib/api/types";
import type { LiveMessage, StreamError } from "@/interfaces/chats.interface";
import type { Citation, SendMessageBody, WebCitation } from "@/types/chats.types";

export type {
  LiveMessage,
  StreamError,
  WebSearchOfferState,
  WebSearchState,
} from "@/interfaces/chats.interface";
export type { StreamPhase } from "@/types/chats.types";

interface StartArgs {
  chatId: string;
  body: SendMessageBody;
  /** The user's typed prompt, so we can render the user bubble locally. */
  userContent: string;
}

interface UseSendMessageResult {
  live: LiveMessage | null;
  send: (args: StartArgs) => void;
  stop: () => void;
  isStreaming: boolean;
}

const RAF_INTERVAL_MS = 50;

/**
 * Drives one chat turn: opens the SSE stream, batches token deltas on
 * `requestAnimationFrame`, exposes a live in-progress message, and merges the
 * finalised message into the react-query messages cache at `message_end`.
 */
export function useSendMessage(): UseSendMessageResult {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [live, setLive] = React.useState<LiveMessage | null>(null);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const bufferRef = React.useRef<string>("");
  const rafRef = React.useRef<number | null>(null);
  const lastFlushRef = React.useRef<number>(0);
  const liveRef = React.useRef<LiveMessage | null>(null);

  const setLiveBoth = React.useCallback((next: LiveMessage | null) => {
    liveRef.current = next;
    setLive(next);
  }, []);

  /**
   * Batches token deltas into a single React render per animation frame,
   * throttled to at most one flush per ~50ms. Flushing every token drops
   * frames on a long answer.
   */
  const scheduleFlush = React.useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const now = performance.now();
      const wait = Math.max(0, RAF_INTERVAL_MS - (now - lastFlushRef.current));
      const doFlush = () => {
        lastFlushRef.current = performance.now();
        const delta = bufferRef.current;
        if (delta.length === 0) return;
        bufferRef.current = "";
        const current = liveRef.current;
        if (current === null) return;
        setLiveBoth({
          ...current,
          content: current.content + delta,
          phase: "streaming",
        });
      };
      if (wait > 0) setTimeout(doFlush, wait);
      else doFlush();
    });
  }, [setLiveBoth]);

  const stop = React.useCallback(() => {
    if (abortRef.current !== null) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    bufferRef.current = "";
  }, []);

  React.useEffect(() => stop, [stop]);

  const send = React.useCallback(
    ({ chatId, body, userContent }: StartArgs) => {
      stop();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      const initial: LiveMessage = {
        userMessageId: "",
        assistantMessageId: "",
        content: "",
        citations: [],
        webCitations: [],
        phase: "starting",
        retrievalChunkCount: null,
        webSearch: null,
        webSearchOffer: null,
        error: null,
      };
      setLiveBoth(initial);

      void (async () => {
        const stream = openChatStream({
          chatId,
          body,
          getToken: async () => (await getToken()) ?? null,
          signal: controller.signal,
        });
        try {
          for await (const evt of stream) {
            switch (evt.type) {
              case "message_start": {
                const current = liveRef.current;
                if (current === null) return;
                setLiveBoth({
                  ...current,
                  userMessageId: evt.data.userMessageId,
                  assistantMessageId: evt.data.assistantMessageId,
                  phase: "retrieving",
                });
                break;
              }
              case "retrieval": {
                const current = liveRef.current;
                if (current === null) return;
                setLiveBoth({
                  ...current,
                  phase: evt.data.status === "started" ? "retrieving" : current.phase,
                  retrievalChunkCount: evt.data.chunkCount,
                });
                break;
              }
              case "citations": {
                const current = liveRef.current;
                if (current === null) return;
                setLiveBoth({
                  ...current,
                  citations: evt.data.citations,
                });
                break;
              }
              case "tool_call": {
                const current = liveRef.current;
                if (current === null) return;
                setLiveBoth({
                  ...current,
                  phase: evt.data.status === "started" ? "web_searching" : current.phase,
                  webSearch: {
                    status: evt.data.status,
                    query: evt.data.query,
                    resultCount: evt.data.resultCount,
                    remainingSearches: evt.data.remainingSearches,
                  },
                });
                break;
              }
              case "web_search_offer": {
                const current = liveRef.current;
                if (current === null) return;
                setLiveBoth({
                  ...current,
                  webSearchOffer: {
                    query: evt.data.query,
                    remainingSearches: evt.data.remainingSearches,
                  },
                });
                break;
              }
              case "web_citations": {
                const current = liveRef.current;
                if (current === null) return;
                setLiveBoth({
                  ...current,
                  webCitations: evt.data.citations,
                });
                break;
              }
              case "token": {
                bufferRef.current += evt.data.delta;
                scheduleFlush();
                break;
              }
              case "usage": {
                // Snapshot only — /me is the authority. We refetch on message_end.
                break;
              }
              case "message_end": {
                flushImmediate();
                const current = liveRef.current;
                if (current === null) return;
                const finalised: LiveMessage = { ...current, phase: "done" };
                setLiveBoth(finalised);
                mergeIntoCache(qc, chatId, {
                  userMessageId: finalised.userMessageId,
                  assistantMessageId: finalised.assistantMessageId,
                  userContent,
                  assistantContent: finalised.content,
                  citations: finalised.citations,
                  webCitations: finalised.webCitations,
                });
                void qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
                setIsStreaming(false);
                abortRef.current = null;
                return;
              }
              case "error": {
                flushImmediate();
                const current = liveRef.current;
                if (current === null) return;
                const details = evt.data.details as
                  | { strike?: 1 | 2; blocked?: boolean }
                  | undefined;
                const err: StreamError = {
                  code: evt.data.code as ErrorCode,
                  message: evt.data.message,
                  strike: details?.strike,
                  blocked: details?.blocked,
                };
                setLiveBoth({ ...current, phase: "error", error: err });
                setIsStreaming(false);
                abortRef.current = null;
                return;
              }
              case "heartbeat":
                break;
            }
          }
          // Stream ended without a terminal event (network close / abort).
          if (controller.signal.aborted) {
            flushImmediate();
            const current = liveRef.current;
            if (current !== null) {
              setLiveBoth({ ...current, phase: "done" });
            }
          }
          setIsStreaming(false);
          abortRef.current = null;
        } catch (cause) {
          if (controller.signal.aborted) {
            setIsStreaming(false);
            abortRef.current = null;
            return;
          }
          const err: StreamError = isApiError(cause)
            ? { code: cause.code, message: cause.message, requestId: cause.requestId }
            : {
                code: "UNKNOWN",
                message: cause instanceof Error ? cause.message : "Stream failed",
              };
          const current = liveRef.current;
          setLiveBoth({
            ...(current ?? initial),
            phase: "error",
            error: err,
          });
          setIsStreaming(false);
          abortRef.current = null;
        }
      })();

      function flushImmediate() {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        const delta = bufferRef.current;
        if (delta.length === 0) return;
        bufferRef.current = "";
        const current = liveRef.current;
        if (current === null) return;
        setLiveBoth({ ...current, content: current.content + delta });
      }
    },
    [getToken, qc, scheduleFlush, setLiveBoth, stop],
  );

  return { live, send, stop, isStreaming };
}

function mergeIntoCache(
  qc: ReturnType<typeof useQueryClient>,
  chatId: string,
  args: {
    userMessageId: string;
    assistantMessageId: string;
    userContent: string;
    assistantContent: string;
    citations: Citation[];
    webCitations: WebCitation[];
  },
) {
  const now = new Date().toISOString();
  const userMsg: Message = {
    id: args.userMessageId,
    chatId,
    role: "user",
    content: args.userContent,
    createdAt: now,
    citations: [],
    webCitations: [],
    consumedTokens: 0,
    modelName: null,
    responseOfMessageId: null,
    reaction: null,
    dislikedReason: null,
  };
  const assistantMsg: Message = {
    id: args.assistantMessageId,
    chatId,
    role: "assistant",
    content: args.assistantContent,
    createdAt: now,
    citations: args.citations,
    webCitations: args.webCitations,
    consumedTokens: 0,
    modelName: null,
    responseOfMessageId: args.userMessageId,
    reaction: null,
    dislikedReason: null,
  };
  qc.setQueryData<Message[]>(messagesQueryKey(chatId), (prev) =>
    prev ? [...prev, userMsg, assistantMsg] : [userMsg, assistantMsg],
  );
  // The server persisted authoritative rows before message_end — resync so we
  // pick up the true tokens/model/citations. Fire-and-forget.
  void qc.invalidateQueries({ queryKey: messagesQueryKey(chatId) });
}

export { ApiError };
