"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
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
import { useDeleteWorkspace, type Workspace } from "@/hooks/use-workspaces";
import { useWorkspaceChatCount } from "@/hooks/use-workspace-chat-count";

interface Props {
  workspace: Workspace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteWorkspaceDialog({ workspace, open, onOpenChange }: Props) {
  const chatCount = useWorkspaceChatCount(workspace.id, open);
  const del = useDeleteWorkspace();
  const router = useRouter();
  const pathname = usePathname();

  async function confirm() {
    try {
      await del.mutateAsync({ id: workspace.id });
      toast.success(`Deleted "${workspace.name}".`);
      onOpenChange(false);
      if (pathname.startsWith(`/workspaces/${workspace.id}`)) {
        router.push("/app");
      }
    } catch (err) {
      if (toast.isApiError(err)) toast.error(err, "Delete failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{workspace.name}&rdquo;?</DialogTitle>
          <DialogDescription>{buildConfirmation(workspace.sourceCount, chatCount.data)}</DialogDescription>
          <p className="text-sm text-[var(--color-fg-muted)]">This can&rsquo;t be undone.</p>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={del.isPending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void confirm()} disabled={del.isPending}>
            {del.isPending ? "Deleting…" : "Delete workspace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildConfirmation(sourceCount: number, chatCount: number | undefined): string {
  const sources = pluralise(sourceCount, "source", "sources");
  if (chatCount === undefined) return `This deletes ${sources} and every chat in this workspace.`;
  const chats = pluralise(chatCount, "chat", "chats");
  return `This deletes ${sources} and ${chats}.`;
}

function pluralise(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
