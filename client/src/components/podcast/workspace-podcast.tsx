"use client";

import * as React from "react";
import {
  Radio,
  Loader2,
  RefreshCw,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/providers/toast";
import { useSources } from "@/hooks/use-sources";
import {
  usePodcast,
  useGeneratePodcast,
  useDeletePodcast,
  isPodcastInProgress,
  type Podcast,
} from "@/hooks/use-podcast";
import { PodcastConfirmDialog } from "./podcast-confirm-dialog";

/** Human phase copy for the producing states. */
const PHASE_LABEL: Record<Podcast["status"], string> = {
  PENDING: "Queued",
  SCRIPTING: "Writing the script",
  SYNTHESIZING: "Recording the hosts",
  READY: "Ready",
  FAILED: "Failed",
};

/** Seconds → m:ss. */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Turn a server `failureReason` slug (e.g. `no_usable_sources`) into a sentence.
 * The set is small and closed; anything unrecognised falls back to the slug.
 */
function failureCopy(reason: string | null): string {
  switch (reason) {
    case "no_usable_sources":
      return "None of this workspace's sources were ready to summarise.";
    case "script_generation_failed":
      return "The hosts' script couldn't be written. Try again.";
    case "synthesis_failed":
      return "The audio couldn't be recorded. Try again.";
    default:
      return reason ?? "Generation failed.";
  }
}

/**
 * The workspace's audio overview: one two-host podcast generated on demand from
 * every ready source. Renders every lifecycle state — absent, producing (with
 * self-polling), ready (player + stale banner), and failed — from the single
 * `usePodcast` query.
 */
export function WorkspacePodcast({ workspaceId }: { workspaceId: string }) {
  const podcast = usePodcast(workspaceId);
  const sources = useSources(workspaceId);
  const generate = useGeneratePodcast(workspaceId);
  const del = useDeletePodcast(workspaceId);

  const [confirm, setConfirm] = React.useState<null | "delete" | "regenerate">(null);
  // Renew an expired signed URL exactly once per READY podcast, no loop.
  const renewedFor = React.useRef<string | null>(null);

  const hasIndexed = (sources.data ?? []).some((s) => s.displayStatus === "indexed");
  const busy = generate.isPending || del.isPending;

  async function runGenerate() {
    try {
      await generate.mutateAsync();
    } catch (err) {
      if (toast.isApiError(err)) toast.error(err, "Couldn't start the podcast");
    }
  }

  async function runRegenerate() {
    setConfirm(null);
    try {
      await del.mutateAsync();
      await generate.mutateAsync();
    } catch (err) {
      if (toast.isApiError(err)) toast.error(err, "Couldn't regenerate the podcast");
    }
  }

  async function runDelete() {
    setConfirm(null);
    try {
      await del.mutateAsync();
      toast.success("Podcast deleted.");
    } catch (err) {
      if (toast.isApiError(err)) toast.error(err, "Delete failed");
    }
  }

  // First load only: keep the panel out of the way rather than flashing a shell.
  if (podcast.isLoading) return null;

  const data = podcast.data ?? null;

  return (
    <section
      className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 sm:px-6"
      aria-label="Audio overview"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-2 text-[var(--color-line-cobalt-text)]">
          <Radio className="size-4" aria-hidden />
          <span className="font-display text-xs uppercase tracking-[0.08em] text-[var(--color-fg)]">
            Audio overview
          </span>
        </span>

        {/* ── No podcast yet ─────────────────────────────────────────────── */}
        {data === null && (
          <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[var(--color-fg-muted)]">
              {hasIndexed
                ? "A ~5-minute, two-host overview of every ready source."
                : "Index a source to generate a two-host audio overview."}
            </p>
            <Button
              size="sm"
              onClick={() => void runGenerate()}
              disabled={!hasIndexed || busy}
            >
              {generate.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Starting
                </>
              ) : (
                "Generate"
              )}
            </Button>
          </div>
        )}

        {/* ── Producing (poll loop is live) ──────────────────────────────── */}
        {data !== null && isPodcastInProgress(data.status) && (
          <div
            className="flex flex-1 items-center gap-2 text-xs text-[var(--color-fg-muted)]"
            role="status"
          >
            <Loader2 className="size-4 animate-spin text-[var(--color-line-cobalt-text)]" aria-hidden />
            <span>{PHASE_LABEL[data.status]}&hellip;</span>
          </div>
        )}

        {/* ── Ready ──────────────────────────────────────────────────────── */}
        {data !== null && data.status === "READY" && data.audioUrl && (
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <audio
              className="h-9 min-w-0 flex-1 sm:max-w-md"
              controls
              preload="metadata"
              src={data.audioUrl}
              onError={() => {
                if (renewedFor.current === data.id) return;
                renewedFor.current = data.id;
                void podcast.refetch();
              }}
            >
              <track kind="captions" />
            </audio>
            {data.durationSeconds !== null && (
              <span className="tabular text-xs text-[var(--color-fg-muted)]">
                {formatDuration(data.durationSeconds)}
              </span>
            )}
            <Button
              size="icon"
              variant="ghost"
              title="Regenerate"
              aria-label="Regenerate podcast"
              onClick={() => setConfirm("regenerate")}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Delete"
              aria-label="Delete podcast"
              onClick={() => setConfirm("delete")}
              disabled={busy}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        )}

        {/* ── Failed ─────────────────────────────────────────────────────── */}
        {data !== null && data.status === "FAILED" && (
          <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-xs text-[var(--color-danger-text)]">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              {failureCopy(data.failureReason)}
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => void runRegenerate()} disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Retrying
                  </>
                ) : (
                  "Try again"
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title="Dismiss"
                aria-label="Dismiss failed podcast"
                onClick={() => void runDelete()}
                disabled={busy}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Stale banner (READY only) ────────────────────────────────────── */}
      {data !== null && data.status === "READY" && data.isStale && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
          <p className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
            <AlertTriangle className="size-4 shrink-0 text-[var(--color-line-amber-text,var(--color-fg-muted))]" aria-hidden />
            The sources changed since this was generated.
          </p>
          <Button size="sm" variant="secondary" onClick={() => setConfirm("regenerate")} disabled={busy}>
            Regenerate
          </Button>
        </div>
      )}

      <PodcastConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => setConfirm(o ? "delete" : null)}
        title="Delete this podcast?"
        description="The audio overview and its file are removed and the slot is freed. This can't be undone — you can generate a new one anytime."
        confirmLabel="Delete podcast"
        pendingLabel="Deleting…"
        variant="danger"
        pending={del.isPending}
        onConfirm={() => void runDelete()}
      />
      <PodcastConfirmDialog
        open={confirm === "regenerate"}
        onOpenChange={(o) => setConfirm(o ? "regenerate" : null)}
        title="Regenerate the podcast?"
        description="The current audio is replaced with a fresh overview of the workspace's sources. This spends tokens on a new script and recording."
        confirmLabel="Regenerate"
        pendingLabel="Starting…"
        variant="primary"
        pending={busy}
        onConfirm={() => void runRegenerate()}
      />
    </section>
  );
}
