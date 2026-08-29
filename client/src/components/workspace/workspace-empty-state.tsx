"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Roundel } from "@/components/ui/roundel";
import { NewWorkspaceDialog } from "./new-workspace-dialog";

/**
 * First run. An empty diagram is still a diagram: the mark sits where the
 * network will be, and the copy invites the one action that starts it.
 */
export function WorkspaceEmptyState() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden px-6 py-16">
      <div className="enamel-watermark pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex max-w-lg flex-col items-start gap-5">
        <Roundel size={44} className="text-[var(--color-line-cobalt)]" />
        <h2 className="text-3xl leading-[1.1]">Make your first workspace.</h2>
        <p className="text-lg leading-relaxed text-[var(--color-fg-muted)]">
          A workspace groups the sources you want to chat with — a set of papers, a
          lecture series, a stack of documentation. Every source becomes its own line,
          and every answer tells you which line it came from. You can chat across
          everything inside one workspace, and only inside one.
        </p>
        <Button variant="primary" size="lg" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          New workspace
        </Button>
      </div>
      <NewWorkspaceDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
