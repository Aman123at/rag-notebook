"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/providers/toast";
import { useSources } from "@/hooks/use-sources";
import { useSourceStatusStream } from "@/hooks/use-source-status-stream";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { AddSourceDialog } from "./add-source-dialog";
import { SourceCard } from "./source-card";
import { PlaylistGroup } from "./playlist-group";
import { SourcesEmptyState } from "./sources-empty-state";
import type { Source } from "@/hooks/use-sources";

/**
 * Split a flat source list into top-level rows and the child videos that hang
 * off each playlist. A YouTube playlist is a single resource; its videos are
 * nested under it rather than listed as siblings.
 */
function groupSources(items: Source[]): {
  topLevel: Source[];
  childrenByParent: Map<string, Source[]>;
} {
  const childrenByParent = new Map<string, Source[]>();
  for (const s of items) {
    if (s.parentSourceId !== null) {
      const list = childrenByParent.get(s.parentSourceId) ?? [];
      list.push(s);
      childrenByParent.set(s.parentSourceId, list);
    }
  }
  const parentIds = new Set(items.filter((s) => s.parentSourceId === null).map((s) => s.id));
  // A child whose parent isn't in this list (shouldn't happen, but defend
  // against it) is promoted to top level so it's never hidden entirely.
  const topLevel = items.filter(
    (s) => s.parentSourceId === null || !parentIds.has(s.parentSourceId),
  );
  return { topLevel, childrenByParent };
}

/** Render one top-level source, expanding playlists into their video group. */
function renderSource(
  source: Source,
  childrenByParent: Map<string, Source[]>,
  compact: boolean,
) {
  if (source.type === "YOUTUBE_PLAYLIST") {
    return (
      <PlaylistGroup
        key={source.id}
        playlist={source}
        videos={childrenByParent.get(source.id) ?? []}
      />
    );
  }
  return <SourceCard key={source.id} source={source} compact={compact} />;
}

interface Props {
  workspaceId: string;
  /**
   * Compact rendering for the sidebar accordion: no heading row, tighter
   * spacing, smaller add button. Cards still show status, retry, delete.
   */
  compact?: boolean;
}

export function SourceList({ workspaceId, compact = false }: Props) {
  const [addOpen, setAddOpen] = React.useState(false);
  const sources = useSources(workspaceId);
  const plan = usePlanLimits();

  // The stream must be re-established on workspace change and torn down on
  // unmount — the hook owns both. See use-source-status-stream.ts.
  useSourceStatusStream(workspaceId);

  const maxSources = plan.limits?.maxSourcesPerWorkspace ?? null;
  // A playlist counts as one resource: cap and count are over top-level rows,
  // not the videos nested under a playlist.
  const topLevelCount =
    sources.data?.filter((s) => s.parentSourceId === null).length ?? 0;
  const count = topLevelCount;
  const atCap = maxSources !== null && count >= maxSources;

  if (sources.isLoading) {
    return (
      <p role="status" className="text-xs text-[var(--color-fg-muted)]">
        Loading sources&hellip;
      </p>
    );
  }
  if (sources.isError) {
    const err = sources.error;
    return (
      <p role="alert" className="text-xs text-[var(--color-danger-text)]">
        Couldn&rsquo;t load sources
        {toast.isApiError(err) ? ` (${err.code} · request ${err.requestId})` : ""}.
      </p>
    );
  }

  const items = sources.data ?? [];
  const { topLevel, childrenByParent } = groupSources(items);

  if (compact) {
    return (
      <>
        <div className="space-y-2">
          <ul className="space-y-1">
            {topLevel.map((source) => renderSource(source, childrenByParent, compact))}
          </ul>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={atCap}
            className="flex w-full items-center gap-1.5 rounded-[var(--radius-control)] border border-dashed border-[var(--color-border)] px-2 py-2 text-xs text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-line-cobalt)] hover:text-[var(--color-fg)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add source
          </button>
          {atCap && (
            <p className="px-1 text-[0.625rem] text-[var(--color-warning-text)]">
              At the {maxSources}-source cap for your plan.
            </p>
          )}
        </div>
        <AddSourceDialog
          workspaceId={workspaceId}
          sourceCount={count}
          open={addOpen}
          onOpenChange={setAddOpen}
        />
      </>
    );
  }

  if (topLevel.length === 0) {
    return (
      <>
        <SourcesEmptyState onAdd={() => setAddOpen(true)} disabled={atCap} />
        <AddSourceDialog
          workspaceId={workspaceId}
          sourceCount={count}
          open={addOpen}
          onOpenChange={setAddOpen}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="tabular text-sm text-[var(--color-fg-muted)]">
          {count} {count === 1 ? "source" : "sources"}
          {maxSources !== null ? ` · ${maxSources - count} left` : ""}
        </p>
        <Button variant="primary" size="sm" onClick={() => setAddOpen(true)} disabled={atCap}>
          <Plus className="h-4 w-4" aria-hidden />
          Add source
        </Button>
      </div>
      {atCap && (
        <p className="text-xs text-[var(--color-warning-text)]">
          This workspace is at its {maxSources}-source cap for your plan.
        </p>
      )}
      <ul className="space-y-2.5">
        {topLevel.map((source) => renderSource(source, childrenByParent, compact))}
      </ul>
      <AddSourceDialog
        workspaceId={workspaceId}
        sourceCount={count}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
    </div>
  );
}
