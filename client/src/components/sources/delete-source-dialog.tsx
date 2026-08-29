"use client";

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
import { useDeleteSource, type Source } from "@/hooks/use-sources";

interface Props {
  source: Source;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteSourceDialog({ source, open, onOpenChange }: Props) {
  const del = useDeleteSource();

  async function confirm() {
    try {
      await del.mutateAsync({ workspaceId: source.workspaceId, sourceId: source.id });
      toast.success(`Deleted "${source.title}".`);
      onOpenChange(false);
    } catch (err) {
      if (toast.isApiError(err)) toast.error(err, "Delete failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{source.title}&rdquo;?</DialogTitle>
          <DialogDescription>
            The source and every chunk indexed from it are removed. Chats that
            already cited it keep their message history but lose live citations.
          </DialogDescription>
          <p className="text-sm text-[var(--color-fg-muted)]">This can&rsquo;t be undone.</p>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={del.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => void confirm()}
            disabled={del.isPending}
          >
            {del.isPending ? "Deleting…" : "Delete source"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
