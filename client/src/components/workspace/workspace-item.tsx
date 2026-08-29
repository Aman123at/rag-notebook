"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Pencil, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/providers/toast";
import { useRenameWorkspace, type Workspace } from "@/hooks/use-workspaces";
import { DeleteWorkspaceDialog } from "./delete-workspace-dialog";
import { SourceList } from "@/components/sources/source-list";

interface Props {
  workspace: Workspace;
  isActive: boolean;
  /** Open on mount without claiming to be the current route. */
  defaultOpen?: boolean;
  sourceCap: number | null;
}

/**
 * A network in the rail: a `<details>` accordion whose summary is the network
 * link and whose body shows its lines. Auto-opens for the active network so
 * the user always sees where they are.
 */
export function WorkspaceItem({ workspace, isActive, defaultOpen = false, sourceCap }: Props) {
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  // `null` = not toggled by user yet; follow `isActive`. Once the user opens or
  // closes the row, their choice sticks — but navigating to a different
  // workspace re-derives from `isActive`, so the active row is always visible.
  // Using the "adjust state during render" pattern with a prev-prop mirror in
  // useState (see React docs — refs would trigger the linter).
  const [userOpen, setUserOpen] = React.useState<boolean | null>(null);
  const [prevActive, setPrevActive] = React.useState(isActive);
  if (prevActive !== isActive) {
    setPrevActive(isActive);
    if (isActive && userOpen === false) setUserOpen(null);
  }
  const open = userOpen ?? (isActive || defaultOpen);

  if (isRenaming) {
    return <RenameForm workspace={workspace} onDone={() => setIsRenaming(false)} />;
  }

  return (
    <>
      <details
        open={open}
        onToggle={(e) => setUserOpen((e.target as HTMLDetailsElement).open)}
        className={cn(
          "group/details mb-1 rounded-[var(--radius-control)]",
          isActive && "bg-[var(--color-surface-2)]",
        )}
      >
        <summary
          className={cn(
            "group relative flex list-none items-center gap-1.5 rounded-[var(--radius-control)] py-2 pl-3 pr-2 text-sm",
            "[&::-webkit-details-marker]:hidden",
            isActive
              ? "text-[var(--color-fg)]"
              : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]",
          )}
        >
          {/* Active marker: a cobalt rule on the leading edge, the way a board
              marks the line you are travelling. Paired with aria-current on the
              link, so it is never colour alone. */}
          <span
            aria-hidden
            className={cn(
              "absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full transition-opacity",
              isActive ? "bg-[var(--color-line-cobalt)] opacity-100" : "opacity-0",
            )}
          />
          <ChevronRight
            className="h-3.5 w-3.5 shrink-0 transition-transform group-open/details:rotate-90"
            aria-hidden
          />
          <Link
            href={`/workspaces/${workspace.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex min-w-0 flex-1 items-center gap-2"
            aria-current={isActive ? "page" : undefined}
            // The visible label lives inside a Radix tooltip trigger, which
            // leaves the link with no computed accessible name. Name it
            // explicitly so screen readers don't announce a bare "link".
            aria-label={workspace.name}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                {/* `title` is the fallback for touch/keyboard where the hover
                    card never shows; the Radix tooltip is the rich hover. */}
                <span className="truncate" title={workspace.name}>
                  {workspace.name}
                </span>
              </TooltipTrigger>
              <TooltipContent>{workspace.name}</TooltipContent>
            </Tooltip>
            <SourceCount count={workspace.sourceCount} cap={sourceCap} />
          </Link>
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsRenaming(true);
                  }}
                  aria-label={`Rename ${workspace.name}`}
                  className="rounded-[var(--radius-control)] p-1 text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent>Rename</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsDeleteOpen(true);
                  }}
                  aria-label={`Delete ${workspace.name}`}
                  className="rounded-[var(--radius-control)] p-1 text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-danger-text)]"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent>Delete workspace</TooltipContent>
            </Tooltip>
          </div>
        </summary>
        {open ? (
          <div className="px-3 pb-3">
            {/* Mounted only while open, so a collapsed row never fetches. */}
            <SourceList workspaceId={workspace.id} compact />
          </div>
        ) : null}
      </details>

      <DeleteWorkspaceDialog
        workspace={workspace}
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
      />
    </>
  );
}

/* The line legend is gone. It drew one unlabelled colour pill per source —
   every nested playlist video included, so a 20-source workspace rendered a
   wall of twenty anonymous swatches — and it sat directly above the same
   sources listed with their titles, status and counts. Colour was the only
   channel it carried, which is the one thing this system refuses, and it was
   telling the reader nothing the list beneath it did not say better. */

function SourceCount({ count, cap }: { count: number; cap: number | null }) {
  const atCap = cap !== null && count >= cap;
  return (
    <span
      className={cn(
        "tabular shrink-0 text-xs",
        atCap ? "text-[var(--color-warning-text)]" : "text-[var(--color-fg-muted)]",
      )}
      aria-label={cap === null ? `${count} sources` : `${count} of ${cap} sources`}
    >
      {cap === null ? count : `${count}/${cap}`}
    </span>
  );
}

function RenameForm({ workspace, onDone }: { workspace: Workspace; onDone: () => void }) {
  const [value, setValue] = React.useState(workspace.name);
  const [nameError, setNameError] = React.useState<string | null>(null);
  const rename = useRenameWorkspace();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  async function submit() {
    const trimmed = value.trim();
    if (!trimmed) {
      setNameError("Give the workspace a name.");
      return;
    }
    if (trimmed === workspace.name) {
      onDone();
      return;
    }
    setNameError(null);
    try {
      await rename.mutateAsync({ id: workspace.id, name: trimmed });
      onDone();
    } catch (err) {
      if (toast.isApiError(err) && err.code === "CONFLICT") {
        setNameError("A workspace with that name already exists.");
        return;
      }
      if (toast.isApiError(err)) toast.error(err, "Rename failed");
      onDone();
    }
  }

  return (
    <div className="mb-1 rounded-[var(--radius-control)] bg-[var(--color-surface-2)] px-2 py-1.5">
      <div className="flex items-center gap-1">
        <label className="sr-only" htmlFor={`rename-${workspace.id}`}>
          Workspace name
        </label>
        <input
          id={`rename-${workspace.id}`}
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (nameError) setNameError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
            if (e.key === "Escape") onDone();
          }}
          aria-invalid={nameError !== null}
          aria-describedby={nameError ? `rename-error-${workspace.id}` : undefined}
          disabled={rename.isPending}
          className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-sm text-[var(--color-fg)] focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={rename.isPending}
          aria-label="Save"
          className="rounded-[var(--radius-control)] p-1 text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-line-cobalt-text)]"
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={rename.isPending}
          aria-label="Cancel"
          className="rounded-[var(--radius-control)] p-1 text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-surface)]"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      {nameError && (
        <p
          id={`rename-error-${workspace.id}`}
          role="alert"
          className="mt-1 px-1 text-xs text-[var(--color-danger-text)]"
        >
          {nameError}
        </p>
      )}
    </div>
  );
}
