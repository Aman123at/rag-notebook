"use client";

import type { StreamPhase, WebSearchState } from "@/hooks/use-send-message";

interface Props {
  phase: StreamPhase;
  webSearch: WebSearchState | null;
  hasContent: boolean;
}

/**
 * Live arrivals — the lifecycle of a turn while it is retrieving, searching
 * and composing.
 *
 * Colour follows the evidence: work against the user's own sources runs on
 * amber, work against the public web runs on the out-of-network grey, and a
 * failed web search runs scarlet. The words say the same thing the colour
 * does, and the parent conversation log announces them politely.
 */
export function StreamStatus({ phase, webSearch, hasContent }: Props) {
  const status = statusLabel(phase, webSearch, hasContent);
  if (status === null) return null;
  const ink = statusInk(phase, webSearch);
  return (
    <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span aria-hidden className="arrivals-track" style={{ ["--arrivals-ink" as string]: ink }} />
      <span className="label-track" style={{ color: ink }}>
        {status.label}
      </span>
      {/* The query is the user's own words. The tracked-caps register belongs
          to the system's labels, so it stays out of it. */}
      {status.detail !== undefined ? (
        <span className="min-w-0 truncate text-xs text-[var(--color-fg-muted)]">
          &ldquo;{status.detail}&rdquo;
        </span>
      ) : null}
    </p>
  );
}

function statusInk(phase: StreamPhase, webSearch: WebSearchState | null): string {
  if (phase === "web_searching") {
    return webSearch?.status === "failed"
      ? "var(--color-line-scarlet-text)"
      : "var(--color-offnet)";
  }
  return "var(--color-line-amber-text)";
}

interface Status {
  label: string;
  /** The user's own words, rendered outside the tracked-caps register. */
  detail?: string;
}

function statusLabel(
  phase: StreamPhase,
  webSearch: WebSearchState | null,
  hasContent: boolean,
): Status | null {
  switch (phase) {
    case "idle":
    case "done":
    case "error":
      return null;
    case "starting":
      return { label: "Preparing" };
    case "retrieving":
      return { label: "Searching your sources" };
    case "web_searching":
      if (webSearch?.status === "failed") return { label: "Web search failed" };
      if (webSearch?.query) return { label: "Searching the web", detail: webSearch.query };
      return { label: "Searching the web" };
    case "streaming":
      return hasContent ? null : { label: "Composing an answer" };
  }
}
