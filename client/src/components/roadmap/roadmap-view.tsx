"use client";

import * as React from "react";
import { toast } from "@/providers/toast";
import { useSourceArtifacts, type Artifact } from "@/hooks/use-artifacts";
import { useSource, useSources } from "@/hooks/use-sources";
import { useModuleProgress } from "@/hooks/use-module-progress";
import {
  parseRoadmapContent,
  type PlaylistVideo,
  type RoadmapContent,
} from "@/lib/roadmap-content";
import { lineForSource, type LineInk } from "@/lib/lines";
import { LineBadge, FieldLabel } from "@/components/ui/chassis";
import { Roundel } from "@/components/ui/roundel";
import { ModuleCard, type StationState } from "./module-card";
import { MissingVideos } from "./missing-videos";
import { RoadmapSkipped } from "./roadmap-skipped";

interface Props {
  sourceId: string;
}

/**
 * Top-level roadmap surface. Reads the newest PLAYLIST_ROADMAP artifact for
 * the source and dispatches by status. See C6 brief for the state matrix:
 *   PENDING → placeholder with a "generating" message
 *   READY   → full render (with the partial-videos note if applicable)
 *   SKIPPED → skip explanation + upgrade path for FREE
 *   FAILED  → error state (no client retry)
 */
export function RoadmapView({ sourceId }: Props) {
  const artifacts = useSourceArtifacts(sourceId);

  if (artifacts.isLoading) return <LoadingState />;
  if (artifacts.isError) return <ArtifactsError error={artifacts.error} />;

  const roadmap = pickLatestRoadmap(artifacts.data ?? []);
  if (!roadmap) return <NoArtifactState />;

  switch (roadmap.status) {
    case "PENDING":
      return <PendingState />;
    case "SKIPPED":
      return <RoadmapSkipped skipReason={roadmap.skipReason} />;
    case "FAILED":
      return <FailedState />;
    case "READY":
      return <ReadyRoadmap artifact={roadmap} sourceId={sourceId} />;
  }
}

/**
 * The playlist's own videos, which the artifact refers to by child source id
 * and nothing else. Two hops, because the roadmap route only knows a source
 * id: read the playlist to learn its workspace, then read that workspace's
 * sources and keep this playlist's children.
 *
 * Returns an empty list while either hop is in flight — the roadmap still
 * renders, with each video named by its id until the join lands.
 */
function usePlaylistVideos(sourceId: string): readonly PlaylistVideo[] {
  const source = useSource(sourceId);
  const workspaceId = source.data?.workspaceId ?? "";
  const sources = useSources(workspaceId);

  return React.useMemo(() => {
    if (!workspaceId || !sources.data) return [];
    return sources.data
      .filter((s) => s.parentSourceId === sourceId)
      .map((s) => ({
        id: s.id,
        title: s.title,
        url: s.originalRef,
        indexed: s.status === "READY",
        failureMessage: s.failure?.message,
      }));
  }, [sourceId, workspaceId, sources.data]);
}

function pickLatestRoadmap(list: readonly Artifact[]): Artifact | null {
  // The server orders artifacts newest-first (v0.6.0 openapi.json describes
  // `list derived artifacts (newest first)`). Kind is a hard-enum today, but
  // keep the filter for forward compat.
  return list.find((a) => a.kind === "PLAYLIST_ROADMAP") ?? null;
}

function ReadyRoadmap({ artifact, sourceId }: { artifact: Artifact; sourceId: string }) {
  // The badge used to read the artifact's own name — the literal words
  // "Learning roadmap", which the heading directly above it already says. A
  // line badge names the source it runs on, so it reads the playlist's real
  // title. The source is already in cache from the page's own fetch.
  const source = useSource(sourceId);
  const sourceTitle = source.data?.title;
  const videos = usePlaylistVideos(sourceId);
  const parsed = React.useMemo(
    () => parseRoadmapContent(artifact.content, videos),
    [artifact.content, videos],
  );
  const progress = useModuleProgress(artifact.id);

  if (!parsed.ok) {
    return <ContentShapeError message={parsed.error} artifactId={artifact.id} />;
  }
  const content: RoadmapContent = parsed.content;
  const total = content.modules.length;
  const completedCount = progress.completed.size;
  const ratio = progress.progressRatio(total);

  // The course belongs to one source, so it runs on that source's line — the
  // same ink the playlist carries in the sidebar and in every citation.
  const line = lineForSource(artifact.sourceId);

  // The first station the reader has not passed. Modules can be ticked out of
  // order, so "current" means the earliest outstanding one, not the one after
  // the last tick.
  const currentIndex = content.modules.findIndex((m) => !progress.isComplete(m.id));

  const time = estimateTime(content, (id) => progress.isComplete(id));

  return (
    <div className="space-y-6">
      <JourneyHeader
        line={line}
        title={sourceTitle ?? artifact.title}
        completed={completedCount}
        total={total}
        ratio={ratio}
        modules={content.modules.map((m) => progress.isComplete(m.id))}
        time={time}
        onReset={completedCount > 0 ? progress.reset : undefined}
      />

      {/* Deliberately not in the playlist's ink: this is a service notice about
          a gap in the route, and the amber severity register is what says so. */}
      <MissingVideos videos={content.missingVideos} />

      <ol>
        {content.modules.map((module, i) => {
          const state: StationState = progress.isComplete(module.id)
            ? "done"
            : i === currentIndex
              ? "current"
              : "ahead";
          return (
            <ModuleCard
              key={module.id}
              module={module}
              state={state}
              line={line}
              isFirst={i === 0}
              isLast={i === total - 1}
              onToggle={() => progress.toggle(module.id)}
            />
          );
        })}
      </ol>
    </div>
  );
}

interface TimeEstimate {
  totalMinutes: number;
  remainingMinutes: number;
  /** Some modules carry `estimatedMinutes: 0`, which means "not estimated". */
  hasUnestimated: boolean;
}

function estimateTime(
  content: RoadmapContent,
  isComplete: (id: string) => boolean,
): TimeEstimate {
  let totalMinutes = 0;
  let remainingMinutes = 0;
  let hasUnestimated = false;
  for (const m of content.modules) {
    if (m.estimatedMinutes === 0) {
      hasUnestimated = true;
      continue;
    }
    totalMinutes += m.estimatedMinutes;
    if (!isComplete(m.id)) remainingMinutes += m.estimatedMinutes;
  }
  return { totalMinutes, remainingMinutes, hasUnestimated };
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/**
 * The route summary: which line this course runs on, how far along it the
 * reader is, and how much of it is left. The strip below the count is the
 * whole journey at a glance — one segment per module, travelled segments in
 * the line's ink — which is the part the vertical route can't show once the
 * course is longer than a screen.
 */
function JourneyHeader({
  line,
  title,
  completed,
  total,
  ratio,
  modules,
  time,
  onReset,
}: {
  line: LineInk;
  title: string;
  completed: number;
  total: number;
  ratio: number;
  modules: readonly boolean[];
  time: TimeEstimate;
  onReset: (() => void) | undefined;
}) {
  const pct = Math.round(ratio * 100);
  return (
    <section className="chassis space-y-3 p-5" aria-label="Route progress">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <LineBadge line={line} label={title} className="min-w-0" />
        <span className="tabular shrink-0 font-mono text-xs text-[var(--color-fg-muted)]">
          {pct}%
        </span>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm text-[var(--color-fg)]">
          <span className="tabular font-mono">{completed}</span> of{" "}
          <span className="tabular font-mono">{total}</span>{" "}
          {total === 1 ? "station" : "stations"} passed
        </p>
        {time.totalMinutes > 0 && (
          <p className="text-xs text-[var(--color-fg-muted)]">
            {time.remainingMinutes === 0
              ? `${formatDuration(time.totalMinutes)} total`
              : `${formatDuration(time.remainingMinutes)} left of ${formatDuration(time.totalMinutes)}`}
            {time.hasUnestimated ? " · some modules aren’t timed" : ""}
          </p>
        )}
      </div>

      <div
        className="flex items-center gap-[3px]"
        role="progressbar"
        aria-label="Modules complete"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
        aria-valuetext={`${completed} of ${total} modules complete`}
      >
        {modules.map((done, i) => (
          <span
            key={i}
            aria-hidden
            className="h-[var(--spine-width)] flex-1 rounded-full transition-colors duration-200 motion-reduce:transition-none"
            style={{ backgroundColor: done ? line.mark : "var(--color-border)" }}
          />
        ))}
      </div>

      {onReset ? (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onReset}
            className="rounded-[var(--radius-control)] text-xs text-[var(--color-fg-muted)] underline-offset-4 transition-colors hover:text-[var(--color-fg)] hover:underline"
          >
            Clear progress
          </button>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Waiting states use the arrivals track — the same "something is on its way"
 * mark the chat uses while an answer is being assembled.
 */
function ArrivalsRow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-sm text-[var(--color-fg-muted)]">
      <span className="arrivals-track" aria-hidden />
      {children}
    </p>
  );
}

function LoadingState() {
  return <ArrivalsRow>Loading this roadmap</ArrivalsRow>;
}

function PendingState() {
  return (
    <section aria-live="polite" className="chassis space-y-3 p-6">
      <ArrivalsRow>Building the route</ArrivalsRow>
      <p className="text-sm leading-relaxed text-[var(--color-fg-muted)]">
        The server is laying out a sequence of modules from this playlist.
        Reload in a minute to see it.
      </p>
    </section>
  );
}

/**
 * A disruption on the line, drawn the way the chat draws one: the severity's
 * ink as a spine down the leading edge, then a sentence that says exactly what
 * happened and what to do about it.
 */
function Disruption({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section
      role="alert"
      className="chassis space-y-2 p-5 text-sm"
      style={{ borderLeft: "var(--spine-width) solid var(--color-line-scarlet-text)" }}
    >
      <h2 className="font-medium text-[var(--color-fg)]">{heading}</h2>
      {children}
    </section>
  );
}

function FailedState() {
  return (
    <Disruption heading="This roadmap couldn’t be built.">
      <p className="leading-relaxed text-[var(--color-fg-muted)]">
        The server tried to lay out a route for this playlist and stopped. It
        won’t retry on its own. If it keeps happening, contact support with the
        source id from this page’s address.
      </p>
    </Disruption>
  );
}

function NoArtifactState() {
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-chassis)] border border-dashed border-[var(--color-border)] p-10">
      <div aria-hidden className="enamel-watermark absolute inset-0" />
      <div className="relative mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
        <Roundel size={40} className="text-[var(--color-fg-muted)]" />
        <FieldLabel>No route yet</FieldLabel>
        <p className="text-sm leading-relaxed text-[var(--color-fg-muted)]">
          No roadmap has been built for this source. Roadmaps are generated on
          the server when a YouTube playlist finishes indexing.
        </p>
      </div>
    </section>
  );
}

function ContentShapeError({
  message,
  artifactId,
}: {
  message: string;
  artifactId: string;
}) {
  return (
    <Disruption heading="This roadmap arrived in an unexpected shape.">
      <p className="leading-relaxed text-[var(--color-fg-muted)]">
        The server returned a roadmap for this source, but it doesn’t match the
        shape this page can draw. Send support the artifact id and field below
        and they can trace it.
      </p>
      <dl className="tabular grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pt-1 font-mono text-[0.6875rem]">
        <dt className="text-[var(--color-fg-muted)]">Artifact</dt>
        <dd className="break-all text-[var(--color-fg)]">{artifactId}</dd>
        <dt className="text-[var(--color-fg-muted)]">Field</dt>
        <dd className="break-all text-[var(--color-fg)]">{message}</dd>
      </dl>
    </Disruption>
  );
}

function ArtifactsError({ error }: { error: unknown }) {
  const detail = toast.isApiError(error) ? error : null;
  return (
    <Disruption heading="The roadmap couldn’t be loaded.">
      <p className="leading-relaxed text-[var(--color-fg-muted)]">
        Something went wrong fetching this source’s roadmap. Reload the page to
        try again.
      </p>
      {detail ? (
        <p className="tabular pt-1 font-mono text-[0.6875rem] tracking-[0.08em] text-[var(--color-fg-muted)]">
          {detail.code} &middot; request {detail.requestId}
        </p>
      ) : null}
    </Disruption>
  );
}
