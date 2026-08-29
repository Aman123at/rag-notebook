"use client";

import * as React from "react";
import type { Message } from "@/hooks/use-messages";
import type { Citation, WebCitation } from "@/contract/sse-events";
import { FieldLabel } from "@/components/ui/chassis";
import { MarkdownAnswer } from "./markdown-answer";
import { ReferencesStrip } from "./references-strip";
import { ReactionButtons } from "./reaction-buttons";

interface UserBubbleProps {
  role: "user";
  content: string;
  createdAt: string;
}
interface AssistantBubbleProps {
  role: "assistant";
  chatId: string;
  message: Message | null;
  content: string;
  citations: Citation[];
  webCitations: WebCitation[];
  isStreaming: boolean;
  createdAt?: string | undefined;
}

type Props = UserBubbleProps | AssistantBubbleProps;

/**
 * A turn in the conversation.
 *
 * The question is an enclosed card — it is the user's own object, and it sits
 * where they put it. The answer is not enclosed: it is the destination, given
 * the full measure of the column, with its route strip underneath. Only one of
 * the two needs a frame, and framing both would flatten the difference between
 * asking and being answered.
 */
export function MessageBubble(props: Props) {
  if (props.role === "user") {
    return (
      <article className="chassis max-w-[62ch] space-y-1.5 self-end px-4 py-3">
        <TurnMeta author="You" at={props.createdAt} />
        <p className="whitespace-pre-wrap text-sm text-[var(--color-fg)]">{props.content}</p>
      </article>
    );
  }
  return (
    <article className="max-w-[68ch] space-y-2 self-start">
      <TurnMeta author="Answer" at={props.createdAt} />
      <div>
        <MarkdownAnswer
          content={props.content}
          citations={props.citations as Citation[]}
          webCitations={props.webCitations as WebCitation[]}
        />
        {props.isStreaming ? <StreamingCaret /> : null}
      </div>
      {!props.isStreaming ? (
        <ReferencesStrip citations={props.citations} webCitations={props.webCitations} />
      ) : null}
      {!props.isStreaming && props.message !== null ? (
        <ReactionButtons chatId={props.chatId} message={props.message} />
      ) : null}
    </article>
  );
}

function TurnMeta({ author, at }: { author: string; at?: string | undefined }) {
  return (
    <FieldLabel className="block">
      {author}
      {at ? <span className="tabular"> &middot; {formatTime(at)}</span> : null}
    </FieldLabel>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** The line still being drawn — a tick riding the end of the text. */
function StreamingCaret() {
  return (
    <span
      aria-hidden
      className="ml-1 inline-block h-3 w-3 translate-y-px rounded-full border-2 border-[var(--color-line-cobalt-text)] motion-safe:animate-pulse"
    />
  );
}
