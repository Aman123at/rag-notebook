"use client";

import * as React from "react";
import { Check, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LineInk } from "@/lib/lines";
import { youtubeLinkFor, type RoadmapModule } from "@/lib/roadmap-content";

/** Where this station sits relative to how far the reader has travelled. */
export type StationState = "done" | "current" | "ahead";

interface Props {
  module: RoadmapModule;
  state: StationState;
  /** The playlist's own line ink — the same ink it carries everywhere else. */
  line: LineInk;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
}

/**
 * One station on the course's line.
 *
 * The roadmap is the single place in the product where a number is information
 * rather than decoration: the modules are an ordered route, and the order is
 * the point. So the number sits inside the station marker, and the line runs
 * through the gutter behind it — travelled in the playlist's ink up to where
 * the reader stopped, unmarked ahead of them.
 *
 * Completion never rests on colour alone: a completed station is filled, its
 * marker carries a tick, its title is struck through, and its control reads
 * "Completed".
 */
export function ModuleCard({ module, state, line, isFirst, isLast, onToggle }: Props) {
  const headingId = `module-${module.id}-title`;
  const complete = state === "done";

  return (
    <li aria-labelledby={headingId} className="relative pb-4 pl-12 last:pb-0">
      <TrackSegment travelled={complete} isFirst={isFirst} isLast={isLast} line={line} />
      <StationMarker order={module.order} state={state} line={line} />

      <div
        className={cn(
          "chassis space-y-3 p-4",
          state === "current" && "border-[var(--station-ink-text)]",
        )}
        style={
          state === "current"
            ? { ["--station-ink-text" as string]: line.text }
            : undefined
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              id={headingId}
              className={cn(
                "font-display text-base font-semibold",
                complete
                  ? "text-[var(--color-fg-muted)] line-through"
                  : "text-[var(--color-fg)]",
              )}
            >
              {module.title}
            </h3>
            <p className="tabular mt-1 font-mono text-[0.6875rem] tracking-[0.06em] text-[var(--color-fg-muted)]">
              {module.estimatedMinutes === 0
                ? "Time not estimated"
                : `${module.estimatedMinutes} min`}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={complete}
            aria-label={
              complete
                ? `Mark module ${module.order} incomplete`
                : `Mark module ${module.order} complete`
            }
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] border px-3 py-1.5",
              "text-[0.6875rem] font-medium uppercase tracking-[0.06em]",
              "transition-[background-color,border-color,color] duration-150 ease-out",
              complete
                ? "border-[var(--color-line-green-text)] text-[var(--color-line-green-text)] hover:bg-[color-mix(in_oklab,var(--color-line-green)_16%,transparent)]"
                : "border-[var(--color-border-strong)] text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]",
            )}
          >
            {complete ? (
              <Check className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <span
                aria-hidden
                className="h-3 w-3 rounded-full border-[1.5px] border-current"
              />
            )}
            {complete ? "Completed" : "Mark complete"}
          </button>
        </div>

        <p className="text-sm leading-relaxed text-[var(--color-fg)]">{module.objective}</p>

        {module.prerequisites.length > 0 && (
          <MetaRow label="Prerequisites" items={module.prerequisites} />
        )}
        {module.keyConcepts.length > 0 && (
          <MetaRow label="Key concepts" items={module.keyConcepts} />
        )}

        {module.videos.length > 0 && (
          <div className="space-y-1.5 border-t border-[var(--color-border)] pt-3">
            <span className="label-track">
              {module.videos.length === 1 ? "1 video" : `${module.videos.length} videos`}
            </span>
            <ol className="space-y-0.5">
              {module.videos.map((video, i) => (
                <li key={`${video.videoId}-${i}`}>
                  <VideoRow video={video} />
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * One video on a station. The artifact refers to videos by source id, so a
 * link only exists once that id has been joined against the playlist's
 * sources — until then, and for a video whose source has gone, the row is
 * still named, just not clickable.
 */
function VideoRow({ video }: { video: RoadmapModule["videos"][number] }) {
  const href = youtubeLinkFor(video);
  const inner = (
    <>
      <PlayCircle className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" aria-hidden />
      <span className="min-w-0 flex-1 truncate group-hover:underline group-hover:underline-offset-4">
        {video.title}
      </span>
    </>
  );
  const shared =
    "group flex items-center gap-2 rounded-[var(--radius-control)] px-1.5 py-1.5 text-sm text-[var(--color-fg)]";

  if (!href) {
    return <span className={shared}>{inner}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(shared, "transition-colors hover:bg-[var(--color-well)]")}
    >
      {inner}
    </a>
  );
}

/**
 * The line running through the gutter. Drawn per station and butted against
 * its neighbours, so the column reads as one continuous route: nothing above
 * the first station, nothing below the last.
 */
function TrackSegment({
  travelled,
  isFirst,
  isLast,
  line,
}: {
  travelled: boolean;
  isFirst: boolean;
  isLast: boolean;
  line: LineInk;
}) {
  // The marker is 32px tall at the top of the row, so its centre — where the
  // line has to start or stop — is 16px down.
  const top = isFirst ? 16 : 0;
  if (isFirst && isLast) return null;

  return (
    <span
      aria-hidden
      className="absolute left-[14.5px] w-[var(--spine-width)]"
      style={{
        top,
        ...(isLast ? { height: `${16 - top}px` } : { bottom: 0 }),
        backgroundColor: travelled ? line.mark : "var(--color-border)",
      }}
    />
  );
}

/**
 * The numbered station. Filled once passed, ringed in the line's ink where the
 * reader is now, and a plain porcelain ring for stations still ahead.
 */
function StationMarker({
  order,
  state,
  line,
}: {
  order: number;
  state: StationState;
  line: LineInk;
}) {
  // The width goes in the inline style, not a Tailwind arbitrary value:
  // `border-[var(--spine-width)]` is ambiguous to Tailwind, which resolves it
  // as a COLOUR and leaves the width at 0 — which silently erases the ring on
  // every station the reader hasn't filled in yet.
  const ring: React.CSSProperties = {
    borderWidth: "var(--spine-width)",
    borderStyle: "solid",
  };
  const style: React.CSSProperties =
    state === "done"
      ? { ...ring, backgroundColor: line.mark, borderColor: line.mark, color: "var(--color-enamel)" }
      : state === "current"
        ? { ...ring, backgroundColor: "var(--color-bg)", borderColor: line.mark, color: line.text }
        : {
            ...ring,
            backgroundColor: "var(--color-bg)",
            borderColor: "var(--color-border-strong)",
            color: "var(--color-fg-muted)",
          };

  return (
    <span
      aria-hidden
      className="tabular absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full font-mono text-xs font-semibold"
      style={style}
    >
      {/* The number stays in every state. Swapping it for a tick would throw
          away the one thing the marker exists to carry, and a filled disc
          against a hollow ring already reads as "passed" in monochrome. */}
      {order}
    </span>
  );
}

function MetaRow({ label, items }: { label: string; items: readonly string[] }) {
  return (
    <div>
      <span className="label-track">{label}</span>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <li
            key={`${item}-${i}`}
            className="rounded-[var(--radius-tick)] border border-[var(--color-border)] bg-[var(--color-well)] px-2.5 py-0.5 text-xs text-[var(--color-fg)]"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
