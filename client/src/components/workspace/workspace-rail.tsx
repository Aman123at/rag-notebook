"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FieldLabel } from "@/components/ui/chassis";
import { WorkspaceItem } from "./workspace-item";
import { NewWorkspaceButton } from "./new-workspace-button";
import { useSource } from "@/hooks/use-sources";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { usePlanLimits } from "@/hooks/use-plan-limits";

/**
 * The network selector. Every workspace is a self-contained network — sources
 * are its lines, and nothing crosses between them. Lives in `(app)/layout.tsx`
 * so it doesn't remount as the user navigates.
 */
export function WorkspaceRail() {
  const workspaces = useWorkspaces();
  const plan = usePlanLimits();
  const params = useParams<{ workspaceId?: string; sourceId?: string }>();
  // A source route (`/sources/:id/roadmap`) carries no workspaceId, so the rail
  // used to go blank on it: the reader stood inside a playlist that belongs to
  // a workspace while the legend showed nothing active and no lines at all —
  // an empty network beside a page about a route through one. The source knows
  // its owner, so ask it.
  const source = useSource(params.sourceId ?? "");
  const activeId = params.workspaceId ?? source.data?.workspaceId;

  // /profile belongs to no workspace, so nothing there is "active" — but the
  // reader arrived from one, and a rail of collapsed rows beside a full page
  // is a legend with the network rubbed out. Remember the last network the
  // reader was in and leave it open, without marking it active: showing where
  // they came from is true, claiming they are still there is not.
  // Adjust-state-during-render with a prev-prop mirror, the same pattern
  // workspace-item.tsx uses for its own open state.
  const [lastOpenId, setLastOpenId] = React.useState<string | undefined>(undefined);
  if (activeId !== undefined && activeId !== lastOpenId) setLastOpenId(activeId);
  const openId = activeId ?? lastOpenId;

  const sourceCap = plan.limits?.maxSourcesPerWorkspace ?? null;
  const workspaceCap = plan.limits?.maxWorkspaces ?? null;
  const count = workspaces.data?.length ?? 0;

  return (
    <TooltipProvider delayDuration={300}>
      <nav
        aria-label="Workspaces"
        className="flex h-full w-full flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]"
      >
        <div className="flex items-baseline justify-between gap-2 px-4 pt-4 pb-2">
          <FieldLabel>Workspaces</FieldLabel>
          {workspaces.data ? (
            <span
              className="tabular text-[0.6875rem] text-[var(--color-fg-muted)]"
              aria-label={
                workspaceCap === null
                  ? `${count} workspaces`
                  : `${count} of ${workspaceCap} workspaces`
              }
            >
              {workspaceCap === null ? count : `${count}/${workspaceCap}`}
            </span>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" role="list">
          {workspaces.isLoading && (
            <p role="status" className="px-2 py-2 text-xs text-[var(--color-fg-muted)]">
              Loading your workspaces&hellip;
            </p>
          )}

          {workspaces.isError && (
            <p role="alert" className="px-2 py-2 text-xs text-[var(--color-danger-text)]">
              Couldn&rsquo;t load your workspaces. Reload the page to try again.
            </p>
          )}

          {workspaces.data && workspaces.data.length === 0 && (
            <p className="px-2 py-3 text-xs leading-relaxed text-[var(--color-fg-muted)]">
              No workspaces yet. Make one below, then add the sources it should
              retrieve over.
            </p>
          )}

          {workspaces.data?.map((w) => (
            <div role="listitem" key={w.id}>
              <WorkspaceItem
                workspace={w}
                isActive={w.id === activeId}
                defaultOpen={w.id === openId}
                sourceCap={sourceCap}
              />
            </div>
          ))}
        </div>

        <div className="shrink-0 border-t border-[var(--color-border)] p-3">
          <NewWorkspaceButton />
        </div>
      </nav>
    </TooltipProvider>
  );
}
