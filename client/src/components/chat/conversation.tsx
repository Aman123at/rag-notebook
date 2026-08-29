"use client";

import * as React from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Roundel } from "@/components/ui/roundel";
import { useMessages } from "@/hooks/use-messages";
import { useSendMessage } from "@/hooks/use-send-message";
import { MessageBubble } from "./message-bubble";
import { Composer } from "./composer";
import { StreamStatus } from "./stream-status";
import { InlineError } from "./inline-error";
import { WebSearchOffer } from "./web-search-offer";
import type { WebSearchOfferState } from "@/interfaces/chats.interface";
import type { SendMessageBody } from "@/lib/api/stream";

interface Props {
  chatId: string;
  sendGate?: { canSend: boolean; reason?: string } | undefined;
}

/**
 * The conversation view: paginated messages, a live streaming assistant
 * bubble (fed by `useSendMessage`), an inline lifecycle indicator, and the
 * composer docked at the bottom. Scrolls to the bottom as tokens arrive,
 * unless the user has scrolled up — in which case we respect their position.
 */
export function Conversation({ chatId, sendGate }: Props) {
  const messages = useMessages(chatId);
  const { live, send, stop, isStreaming } = useSendMessage();
  const [lastPrompt, setLastPrompt] = React.useState<SendMessageBody | null>(null);
  /**
   * Id of an assistant turn whose web-search offer the user dismissed.
   * The offer itself is derived from the live turn rather than copied into
   * state — it is a transient call-to-action, and the assistant's question
   * lives in the message text, which survives a reload where the user can
   * still just answer "yes".
   */
  const [dismissedOfferId, setDismissedOfferId] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const stickyRef = React.useRef(true);

  // Anchor to bottom while streaming, unless the user scrolled away.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      stickyRef.current = nearBottom;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    if (!stickyRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.data, live?.content, live?.phase]);

  const onSend = React.useCallback(
    (body: SendMessageBody) => {
      setLastPrompt(body);
      stickyRef.current = true;
      send({ chatId, body, userContent: body.content });
    },
    [chatId, send],
  );

  const pendingOffer: WebSearchOfferState | null =
    live !== null &&
    live.webSearchOffer !== null &&
    live.assistantMessageId !== dismissedOfferId
      ? live.webSearchOffer
      : null;

  /**
   * Accepting spends one of the chat's web searches. We send the query the
   * assistant proposed with `webSearch: true` — the explicit flag, not a
   * free-text "yes", so consent does not depend on phrase matching.
   */
  const acceptOffer = React.useCallback(() => {
    if (pendingOffer === null) return;
    onSend({ content: pendingOffer.query, webSearch: true });
  }, [pendingOffer, onSend]);

  const retry = React.useCallback(() => {
    if (lastPrompt === null) return;
    stickyRef.current = true;
    send({ chatId, body: lastPrompt, userContent: lastPrompt.content });
  }, [chatId, lastPrompt, send]);

  const persisted = messages.data ?? [];
  // Drop the message pair from `live` once the persisted list picks them up.
  const liveIsPersisted =
    live !== null &&
    persisted.some((m) => m.id === live.assistantMessageId && m.id !== "");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Tooltip.Provider>
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
            {messages.isLoading ? (
              <p className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="arrivals-track"
                  style={{ ["--arrivals-ink" as string]: "var(--color-line-cobalt-text)" }}
                />
                <span className="label-track">Loading this chat</span>
              </p>
            ) : null}
            {messages.error ? (
              <div role="alert" className="chassis space-y-1 border-l-[var(--spine-width)] border-l-[var(--color-line-scarlet-text)] p-4">
                <p className="text-sm font-medium text-[var(--color-line-scarlet-text)]">
                  Couldn&rsquo;t load this chat.
                </p>
                <p className="text-sm text-[var(--color-fg-muted)]">
                  {messages.error.message} Reload the page to try again.
                </p>
              </div>
            ) : null}
            {!messages.isLoading && persisted.length === 0 && live === null ? (
              <EmptyState />
            ) : null}
            {persisted.map((m) =>
              m.role === "user" ? (
                <MessageBubble
                  key={m.id}
                  role="user"
                  content={m.content}
                  createdAt={m.createdAt}
                />
              ) : (
                <MessageBubble
                  key={m.id}
                  role="assistant"
                  chatId={chatId}
                  message={m}
                  content={m.content}
                  citations={m.citations}
                  webCitations={m.webCitations}
                  isStreaming={false}
                  createdAt={m.createdAt}
                />
              ),
            )}
            {live !== null && !liveIsPersisted ? (
              <>
                {live.userMessageId !== "" ? (
                  <MessageBubble
                    role="user"
                    content={lastPrompt?.content ?? ""}
                    createdAt={new Date().toISOString()}
                  />
                ) : null}
                <div className="max-w-[68ch] self-start space-y-2">
                  <StreamStatus
                    phase={live.phase}
                    webSearch={live.webSearch}
                    hasContent={live.content.length > 0}
                  />
                  {live.content.length > 0 || live.phase === "streaming" ? (
                    <MessageBubble
                      role="assistant"
                      chatId={chatId}
                      message={null}
                      content={live.content}
                      citations={live.citations}
                      webCitations={live.webCitations}
                      isStreaming={live.phase === "streaming" || live.phase === "starting"}
                    />
                  ) : null}
                  {live.error !== null ? (
                    <InlineError
                      error={live.error}
                      onRetry={live.error.code === "UPSTREAM_ERROR" ? retry : undefined}
                    />
                  ) : null}
                </div>
              </>
            ) : null}
            {pendingOffer !== null ? (
              <div className="max-w-[68ch] self-start">
                <WebSearchOffer
                  offer={pendingOffer}
                  onAccept={acceptOffer}
                  onDecline={() => setDismissedOfferId(live?.assistantMessageId ?? null)}
                  disabled={isStreaming}
                />
              </div>
            ) : null}
          </div>
        </div>
      </Tooltip.Provider>
      <Composer
        isStreaming={isStreaming}
        onSend={onSend}
        onStop={stop}
        sendGate={sendGate}
      />
    </div>
  );
}

/**
 * An empty chat is an invitation, not an apology. The roundel and the network
 * texture put the reader at the start of a journey that has not departed yet.
 */
function EmptyState() {
  return (
    <div className="chassis relative overflow-hidden px-6 py-12 text-center">
      <div aria-hidden className="enamel-watermark pointer-events-none absolute inset-0" />
      <div className="relative flex flex-col items-center gap-3">
        <Roundel size={44} className="text-[var(--color-line-cobalt-text)]" />
        <p className="font-display text-xl text-[var(--color-fg)]">Ask your first question.</p>
        <p className="max-w-[46ch] text-sm text-[var(--color-fg-muted)]">
          Answers are grounded in every source in this workspace, and every claim carries
          a citation back to the exact page or timestamp it came from.
        </p>
      </div>
    </div>
  );
}
