"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onAdd: () => void;
  disabled?: boolean;
}

/**
 * An empty workspace is a network with no lines yet: the track is laid, and
 * the copy names exactly what can run on it.
 */
export function SourcesEmptyState({ onAdd, disabled }: Props) {
  return (
    <div className="rounded-[var(--radius-chassis)] border border-dashed border-[var(--color-border)] px-6 py-10">
      <div className="mx-auto flex max-w-md flex-col items-start gap-4">
        {/* Track waiting for a line: the ticks are placed, the ink is not. */}
        <div className="flex w-full items-center gap-1" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="flex flex-1 items-center gap-1">
              <span className="h-[3px] flex-1 rounded-full bg-[var(--color-border)]" />
              <span className="h-2.5 w-2.5 flex-none rounded-full border-2 border-[var(--color-border)]" />
            </span>
          ))}
        </div>
        <h3 className="text-xl">Attach something to chat with.</h3>
        <p className="text-sm leading-relaxed text-[var(--color-fg-muted)]">
          You can add a PDF, plain text, a Markdown file, a VTT transcript, a web page, or a
          YouTube video or playlist. Each one becomes its own line, and every answer tells you
          which line it came from.
        </p>
        <Button variant="primary" onClick={onAdd} disabled={disabled}>
          <Plus className="h-4 w-4" aria-hidden />
          Add source
        </Button>
      </div>
    </div>
  );
}
