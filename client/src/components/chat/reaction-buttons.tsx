"use client";

import * as React from "react";
import { ThumbsUp, ThumbsDown, Copy, Check, Volume2, Square } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { useSetReaction, type DislikedReason } from "@/hooks/use-reaction";
import { useTextToSpeech } from "@/hooks/use-text-to-speech";
import { toast } from "@/providers/toast";
import type { Message } from "@/hooks/use-messages";

interface Props {
  chatId: string;
  message: Message;
}

const REASONS: { value: DislikedReason; label: string }[] = [
  { value: "INAPPROPRIATE", label: "Inappropriate" },
  { value: "HALLUCINATED", label: "Made up facts" },
  { value: "INCOMPLETE", label: "Incomplete" },
  { value: "OFF_TOPIC", label: "Off topic" },
  { value: "OTHER", label: "Other" },
];

export function ReactionButtons({ chatId, message }: Props) {
  const setReaction = useSetReaction(chatId);
  const [dislikeOpen, setDislikeOpen] = React.useState(false);
  const [reason, setReason] = React.useState<DislikedReason>("INCOMPLETE");
  const [note, setNote] = React.useState("");

  const like = () =>
    setReaction.mutate({
      messageId: message.id,
      body: { reaction: message.reaction === "like" ? null : "like" },
    });

  const openDislike = () => {
    if (message.reaction === "dislike") {
      setReaction.mutate({ messageId: message.id, body: { reaction: null } });
      return;
    }
    setDislikeOpen(true);
  };

  const tts = useTextToSpeech();
  const [copied, setCopied] = React.useState(false);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      if (copyTimer.current !== null) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2_000);
    } catch {
      toast.error("Couldn't copy to the clipboard.");
    }
  };

  const toggleReadAloud = () => {
    if (tts.speaking) {
      tts.stop();
      return;
    }
    tts.speak(message.content);
  };

  const submitDislike = () => {
    const body =
      note.trim().length > 0
        ? { reaction: "dislike" as const, dislikedReason: reason, dislikedNote: note.trim() }
        : { reaction: "dislike" as const, dislikedReason: reason };
    setReaction.mutate(
      { messageId: message.id, body },
      {
        onSuccess: () => {
          setDislikeOpen(false);
          setNote("");
        },
      },
    );
  };

  return (
    <div className="mt-3 flex items-center gap-1">
      <Button
        size="icon"
        variant="ghost"
        onClick={like}
        disabled={setReaction.isPending}
        aria-label={message.reaction === "like" ? "Remove like" : "Like this answer"}
        aria-pressed={message.reaction === "like"}
        className={
          message.reaction === "like"
            ? "text-[var(--color-line-green-text)]"
            : "text-[var(--color-fg-muted)]"
        }
      >
        <ThumbsUp className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={openDislike}
        disabled={setReaction.isPending}
        aria-label={message.reaction === "dislike" ? "Remove dislike" : "Dislike this answer"}
        aria-pressed={message.reaction === "dislike"}
        className={
          message.reaction === "dislike" ? "text-[var(--color-danger-text)]" : "text-[var(--color-fg-muted)]"
        }
      >
        <ThumbsDown className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => void copy()}
        aria-label={copied ? "Copied" : "Copy this answer"}
        className="text-[var(--color-fg-muted)]"
      >
        {copied ? <Check className="h-4 w-4 text-[var(--color-line-green-text)]" /> : <Copy className="h-4 w-4" />}
      </Button>
      {tts.supported ? (
        <Button
          size="icon"
          variant="ghost"
          onClick={toggleReadAloud}
          aria-label={tts.speaking ? "Stop reading aloud" : "Read this answer aloud"}
          aria-pressed={tts.speaking}
          className={
            tts.speaking ? "text-[var(--color-line-cobalt-text)]" : "text-[var(--color-fg-muted)]"
          }
        >
          {tts.speaking ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      ) : null}

      <Dialog.Root open={dislikeOpen} onOpenChange={setDislikeOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[color-mix(in_oklab,var(--color-enamel-deep)_78%,transparent)]" />
          <Dialog.Content className="route-draw chassis fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 p-5">
            <Dialog.Title className="font-display text-lg">What went wrong?</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-[var(--color-fg-muted)]">
              Your feedback helps improve retrieval quality for this workspace.
            </Dialog.Description>
            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">Reason</legend>
              {REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="dislike-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="accent-[var(--color-line-cobalt)]"
                  />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <label className="mt-4 block text-sm">
              <span className="text-[var(--color-fg-muted)]">Notes (optional)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-well)] p-2 text-sm text-[var(--color-fg)] focus:border-[var(--color-line-cobalt-text)] focus:outline-none"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setDislikeOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={submitDislike} disabled={setReaction.isPending}>
                {setReaction.isPending ? "Sending" : "Send feedback"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
