"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";

/**
 * The signed-in landing. If the user has workspaces, land them in the most recent
 * one. If they don't, show the empty state that invites them to make their first.
 */
export default function AppLanding() {
  const workspaces = useWorkspaces();
  const router = useRouter();

  React.useEffect(() => {
    if (workspaces.data && workspaces.data.length > 0) {
      const first = workspaces.data[0];
      if (first) router.replace(`/workspaces/${first.id}`);
    }
  }, [workspaces.data, router]);

  if (workspaces.isLoading) {
    return (
      <section className="p-6" role="status">
        <p className="text-sm text-[var(--color-fg-muted)]">Loading your workspaces&hellip;</p>
      </section>
    );
  }

  if (workspaces.isError) {
    // The route-group error boundary will render this; throw for that path.
    throw workspaces.error;
  }

  if (!workspaces.data || workspaces.data.length === 0) {
    return <WorkspaceEmptyState />;
  }

  // Redirecting; render nothing to avoid a flash.
  return null;
}
