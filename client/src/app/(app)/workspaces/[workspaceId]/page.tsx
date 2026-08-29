"use client";

import { useParams, notFound } from "next/navigation";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useSources } from "@/hooks/use-sources";
import { useWorkspaceChat } from "@/hooks/use-workspace-chat";
import { useSourceStatusStream } from "@/hooks/use-source-status-stream";
import { Conversation } from "@/components/chat/conversation";

/**
 * The workspace page IS the chat. One chat per workspace: the id is
 * auto-provisioned by `useWorkspaceChat`, so the URL never carries a chatId.
 * The send button is gated until at least one source in this workspace is
 * indexed — the composer renders the reason as a banner.
 */
export default function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const workspaces = useWorkspaces();
  const sources = useSources(workspaceId);
  const chat = useWorkspaceChat(workspaceId);
  // Live pipeline updates for the sidebar and gate flip once indexing finishes.
  useSourceStatusStream(workspaceId);

  if (workspaces.isLoading) {
    return (
      <section className="p-6" role="status">
        <p className="text-sm text-[var(--color-fg-muted)]">Loading&hellip;</p>
      </section>
    );
  }

  const workspace = workspaces.data?.find((w) => w.id === workspaceId);
  if (!workspace) return notFound();

  const items = sources.data ?? [];
  const hasIndexed = items.some((s) => s.displayStatus === "indexed");
  const hasSources = items.length > 0;
  const anyProcessing = items.some(
    (s) => s.displayStatus === "uploading" || s.displayStatus === "processing",
  );

  const sendGate: { canSend: boolean; reason?: string } = hasIndexed
    ? { canSend: true }
    : {
        canSend: false,
        reason: hasSources
          ? anyProcessing
            ? "Indexing your source — send opens as soon as one is ready."
            : "Add a source to start the conversation."
          : "Add a source to start the conversation.",
      };

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--color-border)] px-4 py-3 sm:px-6">
        <h1 className="min-w-0 truncate font-display text-lg uppercase tracking-[0.04em] text-[var(--color-fg)]">
          {workspace.name}
        </h1>
        <span
          className="tabular shrink-0 text-xs text-[var(--color-fg-muted)]"
          aria-label={`${items.length} ${items.length === 1 ? "source" : "sources"} in this workspace`}
        >
          {items.length} {items.length === 1 ? "source" : "sources"}
        </span>
      </header>
      {chat.isLoading || !chat.data ? (
        <div className="flex-1 p-6">
          <p role="status" className="text-sm text-[var(--color-fg-muted)]">
            Opening chat&hellip;
          </p>
        </div>
      ) : chat.isError ? (
        <div className="flex-1 p-6">
          <p role="alert" className="text-sm text-[var(--color-danger-text)]">
            Couldn&rsquo;t open the chat for this workspace. {chat.error.message}
          </p>
        </div>
      ) : (
        <Conversation chatId={chat.data.id} sendGate={sendGate} />
      )}
    </section>
  );
}
