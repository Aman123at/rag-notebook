"use client";

import { useParams } from "next/navigation";
import { RoadmapView } from "@/components/roadmap/roadmap-view";

/**
 * Learning roadmap for a YouTube-playlist source. Reads the newest
 * PLAYLIST_ROADMAP artifact via GET /sources/:id/artifacts and hands off to
 * RoadmapView, which dispatches on the artifact status.
 */
export default function SourceRoadmapPage() {
  const { sourceId } = useParams<{ sourceId: string }>();

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      {/* The kicker that used to sit here duplicated the heading and hand-rolled
          `.label-track` — which the system reserves for field labels, never for
          a line above a title. The roadmap's real name is on the line badge in
          the route summary below. */}
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold">Learning roadmap</h1>
        <p className="max-w-prose text-sm leading-relaxed text-[var(--color-fg-muted)]">
          A route through this playlist, built on the server. Mark each station
          as you pass it — progress is kept on this device, not your account.
        </p>
      </header>
      <RoadmapView sourceId={sourceId} />
    </section>
  );
}
