"use client";

import * as React from "react";
import { lineForSource } from "@/lib/lines";
import { LineBadge } from "@/components/ui/chassis";

/**
 * The shared parts of a station detail — the card that opens when a reader
 * follows a citation. Kept in its own module because both the marker and the
 * rich file preview need them, and importing one from the other would be a
 * cycle.
 */

/**
 * Which line, and which stop on it. The badge carries the source's real title:
 * the colour identifies, the words are what the reader actually reads.
 */
export function StationHeader({
  sourceId,
  sourceTitle,
  locator,
}: {
  sourceId: string;
  sourceTitle: string;
  locator: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <LineBadge line={lineForSource(sourceId)} label={sourceTitle} className="min-w-0" />
      <span className="tabular shrink-0 font-mono text-[10px] tracking-[0.08em] text-[var(--color-fg-muted)]">
        {locator}
      </span>
    </div>
  );
}

/**
 * Retrieval strength, drawn as a measured bar.
 */
export function RetrievalStrength({
  score,
  peerMaxScore,
}: {
  score: number;
  peerMaxScore: number | undefined;
}) {
  if (peerMaxScore === undefined || peerMaxScore <= 0) return null;
  const share = Math.max(0, Math.min(1, score / peerMaxScore));
  const pct = Math.round(share * 100);
  // The passage the bar is measured against is not "100% of itself" — it is
  // the best match, and saying so is both shorter and more useful.
  const isBest = pct >= 100;
  return (
    <div className="space-y-1 pt-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="label-track">{isBest ? "Best match" : "Strength vs. best match"}</span>
        {isBest ? null : (
          <span className="tabular font-mono text-[10px] text-[var(--color-fg-muted)]">{pct}%</span>
        )}
      </div>
      <div
        className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]"
        role="img"
        aria-label={
          isBest
            ? "The best-matching passage found for this answer"
            : `${pct}% as strong as the best-matching passage found for this answer`
        }
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: "var(--station-ink-text, var(--color-citation-text))",
          }}
        />
      </div>
    </div>
  );
}

/** The single action a station detail offers: go to the passage itself. */
export function OpenAction({ children }: { children: React.ReactNode }) {
  return (
    <p className="label-track pt-1 text-[var(--station-ink-text,var(--color-citation-text))]">
      {children} &#8599;
    </p>
  );
}
