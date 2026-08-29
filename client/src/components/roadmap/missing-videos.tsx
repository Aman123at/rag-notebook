"use client";

import { AlertTriangle } from "lucide-react";
import type { RoadmapMissingVideo } from "@/lib/roadmap-content";

interface Props {
  videos: readonly RoadmapMissingVideo[];
}

/**
 * The "partial" case (C6 brief §4): some videos in the playlist failed to
 * ingest. The roadmap covers what exists; this block names what's missing so
 * the user understands the gap rather than assuming coverage they don't have.
 *
 * A service notice, not an error — the route runs, it just doesn't call at
 * every stop. It carries the amber severity ink rather than the playlist's own
 * line ink, because what it reports is a condition, not a source.
 */
export function MissingVideos({ videos }: Props) {
  if (videos.length === 0) return null;
  return (
    <aside
      aria-labelledby="missing-videos-heading"
      className="chassis space-y-2 p-4"
      style={{ borderLeft: "var(--spine-width) solid var(--color-line-amber-text)" }}
    >
      {/* Not `ServiceStatus severity="working"`: that pairs amber with a dashed
          spinner, which promises the gap is being worked on. These videos are
          never coming — the warning icon says so and the amber says how much
          it matters. */}
      <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-line-amber-text)]">
        <AlertTriangle className="h-3.5 w-3.5 flex-none" aria-hidden />
        Partial coverage
      </span>

      <h2 id="missing-videos-heading" className="text-sm font-medium text-[var(--color-fg)]">
        {videos.length === 1
          ? "1 video from this playlist isn’t in the route"
          : `${videos.length} videos from this playlist aren’t in the route`}
      </h2>
      <p className="text-xs leading-relaxed text-[var(--color-fg-muted)]">
        These didn’t finish indexing, so no module references them. Everything
        else below is built from videos that did.
      </p>

      <ul className="space-y-1.5 pt-1">
        {videos.map((video, i) => (
          <li
            key={`${video.videoId ?? "missing"}-${i}`}
            className="flex items-baseline gap-2 text-xs"
          >
            {/* A hollow tick: a stop the line was meant to call at, and didn't. */}
            <span
              aria-hidden
              className="mt-[0.35em] h-2 w-2 flex-none rounded-full border-[1.5px] border-[var(--color-line-amber-text)]"
            />
            <span className="min-w-0">
              <span className="text-[var(--color-fg)]">
                {video.title ?? video.videoId ?? "Untitled video"}
              </span>
              {video.reason ? (
                <span className="text-[var(--color-fg-muted)]"> — {video.reason}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
