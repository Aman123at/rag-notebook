"use client";

import * as React from "react";
import { ArrowUp, Globe, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useSpeechToText } from "@/hooks/use-speech-to-text";
import { toast } from "@/providers/toast";
import type { SendMessageBody } from "@/lib/api/stream";

const MODELS = [
  { value: "gpt-4o-mini" as const, label: "gpt-4o-mini" },
  { value: "gpt-4o" as const, label: "gpt-4o" },
];

interface Props {
  isStreaming: boolean;
  onSend: (body: SendMessageBody) => void;
  onStop: () => void;
  /**
   * External gate that blocks sending even when the text is valid. Used to
   * require at least one indexed source before the first message.
   */
  sendGate?: { canSend: boolean; reason?: string } | undefined;
}

/** Count "words" by run of non-whitespace. Matches how the server bills. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Chat composer. Enter to send, Shift+Enter for newline. Word counter reflects
 * the plan's `maxPromptWords`; warns at 90%, hard-blocks at 100% showing the
 * exact numbers. Web-search toggle. Model selector when more than one is
 * available. Focus stays in the textarea after send.
 *
 * No source picker — retrieval is workspace-wide (CLIENT-PLAN §1).
 */
export function Composer({ isStreaming, onSend, onStop, sendGate }: Props) {
  const gated = sendGate !== undefined && !sendGate.canSend;
  const [text, setText] = React.useState("");
  const [webSearch, setWebSearch] = React.useState(false);
  const [model, setModel] = React.useState<SendMessageBody["model"]>("gpt-4o-mini");
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const limits = usePlanLimits();

  // Dictation. `baseRef` holds the text present when listening began and
  // `finalRef` accumulates settled phrases, so interim results can be shown
  // live without clobbering what the user already typed.
  const baseRef = React.useRef("");
  const finalRef = React.useRef("");
  const stt = useSpeechToText({
    onResult: (transcript, isFinal) => {
      if (isFinal) finalRef.current += transcript;
      const interim = isFinal ? "" : transcript;
      setText((baseRef.current + finalRef.current + interim).replace(/^\s+/, ""));
    },
    onError: (err) => {
      // These are routine (silence / user-stopped), not worth a toast.
      if (err !== "no-speech" && err !== "aborted") {
        toast.error(`Microphone error: ${err}`);
      }
    },
  });

  const toggleMic = () => {
    if (stt.listening) {
      stt.stop();
      queueMicrotask(() => textareaRef.current?.focus());
      return;
    }
    baseRef.current = text.length > 0 ? `${text.replace(/\s+$/, "")} ` : "";
    finalRef.current = "";
    stt.start();
  };

  const wordCount = countWords(text);
  const cap = limits.limits?.maxPromptWords ?? null;
  const overCap = cap !== null && wordCount > cap;
  const nearCap = cap !== null && !overCap && wordCount / cap >= 0.9;

  const submit = () => {
    if (isStreaming) return;
    if (gated) return;
    const content = text.trim();
    if (content.length === 0) return;
    if (overCap) return;
    const body: SendMessageBody = { content, webSearch };
    if (model !== undefined) body.model = model;
    if (stt.listening) stt.stop();
    onSend(body);
    setText("");
    // Preserve focus for the next message.
    queueMicrotask(() => textareaRef.current?.focus());
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const disabled = isStreaming || text.trim().length === 0 || overCap || gated;

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      {gated && sendGate?.reason ? (
        <div role="status" className="mx-auto max-w-3xl px-4 pt-3 sm:px-6">
          <p className="rounded-[var(--radius-control)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-well)] px-3 py-2 text-xs text-[var(--color-fg-muted)]">
            {sendGate.reason}
          </p>
        </div>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-3 sm:px-6"
      >
        <label htmlFor="composer" className="sr-only">
          Ask something about your sources
        </label>
        <textarea
          id="composer"
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask something about your sources…"
          rows={2}
          className="w-full resize-none rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-well)] p-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-muted)] focus:border-[var(--color-line-cobalt-text)] focus:outline-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWebSearch((v) => !v)}
              aria-pressed={webSearch}
              className={`label-track inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border px-2 py-1 transition-[background-color,border-color,box-shadow,color] ${
                webSearch
                  ? "border-[var(--color-line-cobalt-text)] text-[var(--color-line-cobalt-text)] shadow-[0_0_0_1px_var(--color-line-cobalt-text)]"
                  : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              }`}
            >
              <Globe className="h-3 w-3" aria-hidden />
              Web
            </button>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as SendMessageBody["model"])}
              className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-transparent px-2 py-1 font-mono text-xs text-[var(--color-fg-muted)] focus:border-[var(--color-line-cobalt-text)] focus:outline-none"
              aria-label="Model"
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value} className="bg-[var(--color-surface)]">
                  {m.label}
                </option>
              ))}
            </select>
            <WordCounter count={wordCount} cap={cap} nearCap={nearCap} overCap={overCap} />
          </div>
          <div className="flex items-center gap-2">
            {stt.supported ? (
              <button
                type="button"
                onClick={toggleMic}
                aria-pressed={stt.listening}
                aria-label={stt.listening ? "Stop dictation" : "Dictate with your voice"}
                className={`inline-flex items-center justify-center rounded-[var(--radius-control)] border p-1.5 transition-colors ${
                  stt.listening
                    ? "border-[var(--color-line-scarlet-text)] text-[var(--color-line-scarlet-text)] motion-safe:animate-pulse"
                    : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                }`}
              >
                <Mic className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
            {isStreaming ? (
              <Button type="button" variant="secondary" size="sm" onClick={onStop}>
                <Square className="h-3 w-3" />
                Stop
              </Button>
            ) : (
              <Button type="submit" size="sm" disabled={disabled} aria-label="Send message">
                <ArrowUp className="h-4 w-4" />
                Send
              </Button>
            )}
          </div>
        </div>
        {overCap && cap !== null ? (
          <p role="alert" className="font-mono text-xs text-[var(--color-danger-text)]">
            {wordCount.toLocaleString()} / {cap.toLocaleString()} words — trim the prompt to send.
          </p>
        ) : null}
      </form>
    </footer>
  );
}

function WordCounter({
  count,
  cap,
  nearCap,
  overCap,
}: {
  count: number;
  cap: number | null;
  nearCap: boolean;
  overCap: boolean;
}) {
  if (cap === null) {
    return (
      <span className="font-mono text-xs text-[var(--color-fg-muted)]">
        {count.toLocaleString()} words
      </span>
    );
  }
  const tone = overCap
    ? "text-[var(--color-danger-text)]"
    : nearCap
      ? "text-[var(--color-citation-text)]"
      : "text-[var(--color-fg-muted)]";
  return (
    <span className={`font-mono text-xs ${tone}`}>
      {count.toLocaleString()} / {cap.toLocaleString()} words
    </span>
  );
}
