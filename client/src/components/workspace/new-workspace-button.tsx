"use client";

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NewWorkspaceDialog } from "./new-workspace-dialog";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useWorkspaces } from "@/hooks/use-workspaces";

/**
 * Cap-aware entry point. Disables the button when the client already knows the
 * user is at their workspace cap, tooltip names the limit and links to upgrade.
 * The server enforces the same cap on POST /workspaces — the dialog also
 * renders PLAN_LIMIT_EXCEEDED inline, because limits can change mid-session.
 */
export function NewWorkspaceButton() {
  const [open, setOpen] = React.useState(false);
  const plan = usePlanLimits();
  const workspaces = useWorkspaces();

  const cap = plan.limits?.maxWorkspaces ?? null;
  const count = workspaces.data?.length ?? 0;
  const atCap = cap !== null && count >= cap;

  if (atCap) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-block">
            <Button variant="secondary" disabled className="w-full justify-start">
              <Plus className="h-4 w-4" aria-hidden />
              New workspace
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <p className="mb-1">
            You&rsquo;ve reached your {cap}-workspace limit on the {plan.plan} plan.
          </p>
          <Link
            href="/pricing"
            className="text-[var(--color-accent)] underline underline-offset-2"
          >
            Upgrade to add more
          </Link>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
        className="w-full justify-start"
      >
        <Plus className="h-4 w-4" aria-hidden />
        New workspace
      </Button>
      <NewWorkspaceDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
