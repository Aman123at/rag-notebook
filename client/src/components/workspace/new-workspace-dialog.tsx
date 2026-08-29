"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/providers/toast";
import { useCreateWorkspace } from "@/hooks/use-workspaces";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewWorkspaceDialog({ open, onOpenChange }: Props) {
  const [name, setName] = React.useState("");
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [limitError, setLimitError] = React.useState<string | null>(null);
  const create = useCreateWorkspace();
  const router = useRouter();

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("");
      setNameError(null);
      setLimitError(null);
    }
    onOpenChange(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Give the workspace a name.");
      return;
    }
    setNameError(null);
    setLimitError(null);
    try {
      const created = await create.mutateAsync({ name: trimmed });
      handleOpenChange(false);
      toast.success(`Created "${created.name}".`);
      router.push(`/workspaces/${created.id}`);
    } catch (err) {
      if (!toast.isApiError(err)) return;
      if (err.code === "CONFLICT") {
        setNameError("A workspace with that name already exists.");
        return;
      }
      if (err.code === "PLAN_LIMIT_EXCEEDED") {
        // The server enforces the cap even when the client thought there was room —
        // e.g. limits changed mid-session. Render the block in the dialog instead of
        // creating a workspace the user can't have.
        setLimitError(err.message || "You've reached your workspace limit on your current plan.");
        return;
      }
      if (err.code === "VALIDATION_ERROR") {
        setNameError(err.message);
        return;
      }
      toast.error(err, "Couldn't create workspace");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>
              Group the sources you want to chat with together. A source belongs to
              exactly one workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-1">
            <label htmlFor="workspace-name" className="text-sm">
              Name
            </label>
            <input
              id="workspace-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              autoFocus
              aria-invalid={nameError !== null}
              aria-describedby={nameError ? "workspace-name-error" : undefined}
              disabled={create.isPending}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-[var(--color-accent)]"
              placeholder="e.g. Papers on RAG"
              maxLength={120}
            />
            {nameError && (
              <p id="workspace-name-error" role="alert" className="text-xs text-[var(--color-danger-text)]">
                {nameError}
              </p>
            )}
            {limitError && (
              <p role="alert" className="pt-2 text-xs text-[var(--color-danger-text)]">
                {limitError}
              </p>
            )}
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="secondary"
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
