"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { lineForSource } from "@/lib/lines";
import { ServiceStatus } from "@/components/ui/service-status";
import type { Source } from "@/hooks/use-sources";
import { SourceCard } from "./source-card";

interface Props {
  playlist: Source;
  videos: Source[];
}

/**
 * A playlist is a line with branches: the playlist itself is the trunk, and
 * each video hangs off it as a stop on the same ink. Auto-expands while any
 * video is still processing so the user sees progress; collapses once
 * everything is terminal. The user's manual toggle wins over the auto
 * behaviour.
 */
export function PlaylistGroup({ playlist, videos }: Props) {
  const processing = videos.filter(
    (v) => v.displayStatus === "processing" || v.displayStatus === "uploading",
  );
  const failed = videos.filter((v) => v.displayStatus === "failed" || v.status === "QUARANTINED");
  const indexed = videos.filter((v) => v.displayStatus === "indexed");
  const isBusy = processing.length > 0;
  const line = lineForSource(playlist.id);

  // `null` until the user toggles; before that, follow the busy state so an
  // in-progress import stays open and a finished one collapses on its own.
  const [userOpen, setUserOpen] = React.useState<boolean | null>(null);
  const open = userOpen ?? isBusy;

  return (
    <li className="chassis relative overflow-hidden">
      {/* The playlist row is the trunk of the line, and it sits OUTSIDE the
          disclosure. It used to be the first child inside <details>, before
          the <summary> — where the browser hides it whenever the group is
          collapsed. The result was a row that named nothing: two playlists in
          the rail both read "Show 9 videos" with no title on either, so the
          reader could not tell one line from the other. A trunk that vanishes
          when its branches are folded away is not a trunk. */}
      <ul>
        <SourceCard source={playlist} bare />
      </ul>

      <details
        open={open}
        onToggle={(e) => setUserOpen((e.target as HTMLDetailsElement).open)}
        className="group/playlist"
      >
        <summary
          className={cn(
            "flex cursor-pointer list-none items-center gap-2 border-t border-[var(--color-border)]",
            "px-4 py-2 text-xs text-[var(--color-fg-muted)] transition-colors",
            "hover:text-[var(--color-fg)] [&::-webkit-details-marker]:hidden",
          )}
        >
          <ChevronRight
            className="h-4 w-4 shrink-0 transition-transform group-open/playlist:rotate-90"
            aria-hidden
          />
          <span className="font-medium">
            {open ? "Hide" : "Show"} {videos.length} {videos.length === 1 ? "video" : "videos"}
          </span>
          <SummaryCounts
            indexed={indexed.length}
            failed={failed.length}
            processing={processing.length}
          />
        </summary>

        <div className="pb-2">
          {videos.length > 0 ? (
            <ul
              className="route-spine ml-6 space-y-1"
              style={{
                ["--spine-ink" as string]: `color-mix(in oklab, ${line.mark} 60%, transparent)`,
              }}
            >
              {videos.map((video) => (
                <SourceCard key={video.id} source={video} compact stop />
              ))}
            </ul>
          ) : (
            <p className="px-4 pb-2 text-xs text-[var(--color-fg-muted)]">
              No videos yet — resolving the playlist&hellip;
            </p>
          )}
        </div>
      </details>
    </li>
  );
}

function SummaryCounts({
  indexed,
  failed,
  processing,
}: {
  indexed: number;
  failed: number;
  processing: number;
}) {
  const parts: React.ReactNode[] = [];
  if (indexed > 0) {
    parts.push(
      <ServiceStatus key="ok" severity="good">
        {indexed} indexed
      </ServiceStatus>,
    );
  }
  if (processing > 0) {
    parts.push(
      <ServiceStatus key="busy" severity="working" active>
        {processing} processing
      </ServiceStatus>,
    );
  }
  if (failed > 0) {
    parts.push(
      <ServiceStatus key="fail" severity="down">
        {failed} failed
      </ServiceStatus>,
    );
  }
  if (parts.length === 0) return null;
  return <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">{parts}</span>;
}
