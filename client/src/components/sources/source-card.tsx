"use client";

import * as React from "react";
import Link from "next/link";
import {
  Download,
  FileText,
  Film,
  Globe,
  ListVideo,
  Map,
  RefreshCw,
  Trash2,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceStatus } from "@/components/ui/service-status";
import { cn } from "@/lib/utils";
import { lineForSource } from "@/lib/lines";
import { toast } from "@/providers/toast";
import { useDownloadSource, useRetrySource, type Source } from "@/hooks/use-sources";
import { DeleteSourceDialog } from "./delete-source-dialog";

interface Props {
  source: Source;
  compact?: boolean;
  /** Nested inside a group that already draws the enclosure. */
  bare?: boolean;
  /** Rendered as a stop hanging off a parent line, so it draws a station tick. */
  stop?: boolean;
}

/**
 * A source is a line. The card carries that line's ink down its leading edge
 * as a spine with a station tick, and reports its condition the way a network
 * reports a line's: an icon, a word, and a colour, in that order of authority.
 */
export function SourceCard({ source, compact = false, bare = false, stop = false }: Props) {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const line = lineForSource(source.id);

  return (
    <li
      className={cn(
        "relative",
        stop ? "route-stop overflow-visible" : "overflow-hidden",
        bare
          ? "py-3 pl-5 pr-3"
          : compact
            ? "rounded-[var(--radius-control)] bg-[var(--color-surface-2)] py-2 pl-4 pr-2"
            : "chassis py-4 pl-5 pr-4",
      )}
    >
      {/* The line itself, running the full height of the card. Uses the mark
          tint, not the saturated ink: these cards sit on a raised surface
          where raw cobalt measures 2.91:1 and vanishes. */}
      {/* The line, with its station on it. The rule alone had been shipping
          since this card was written — the comment above always said "a spine
          with a station tick" and the tick was never drawn, which left every
          source card wearing a bare coloured border-left: the one surface
          treatment this system refuses. The tick is what makes it a line. */}
      {!stop && (
        <>
          {/* The rule is inset from the card's edge so the station sitting on
              it reads as a whole circle. Flush against the boundary, the ring
              was clipped in half by the card's own overflow and rendered as a
              nick bitten out of the line — a gap in a stripe, which is the
              opposite of what a station signals. */}
          <span
            aria-hidden
            className="absolute inset-y-0 w-[3px]"
            style={{ left: "6px", backgroundColor: line.mark }}
          />
          <span
            aria-hidden
            className="station-tick absolute"
            style={{
              left: "2px",
              top: bare ? "1.15rem" : compact ? "0.8rem" : "1.4rem",
              borderColor: line.mark,
              backgroundColor: "var(--color-porcelain)",
            }}
          />
        </>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <TypeIcon type={source.type} compact={compact} />
          <div className="min-w-0 flex-1">
            <h4
              className={cn(
                "truncate font-medium text-[var(--color-fg)]",
                compact ? "text-xs" : "text-sm",
              )}
              title={source.title}
            >
              {source.title}
            </h4>
            {!compact && (
              <p className="tabular mt-0.5 truncate text-xs text-[var(--color-fg-muted)]">
                {source.originalRef}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {source.type === "YOUTUBE_PLAYLIST" && (
            <Link
              href={`/sources/${source.id}/roadmap`}
              aria-label={`View learning roadmap for ${source.title}`}
              className="rounded-[var(--radius-control)] p-1.5 text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
            >
              <Map className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
            </Link>
          )}
          {isDownloadable(source) && <DownloadButton source={source} />}
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            aria-label={`Delete ${source.title}`}
            className="rounded-[var(--radius-control)] p-1.5 text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-danger-text)]"
          >
            <Trash2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
          </button>
        </div>
      </div>

      <StatusRow source={source} compact={compact} />

      <DeleteSourceDialog source={source} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </li>
  );
}

function TypeIcon({ type, compact }: { type: Source["type"]; compact: boolean }) {
  const cls = cn("mt-0.5 flex-none text-[var(--color-fg-muted)]", compact ? "h-3.5 w-3.5" : "h-4 w-4");
  switch (type) {
    case "PDF":
      return <FileText className={cls} aria-label="PDF" />;
    case "TEXT":
      return <FileText className={cls} aria-label="Text" />;
    case "VTT":
      return <Film className={cls} aria-label="VTT" />;
    case "WEB_URL":
      return <Globe className={cls} aria-label="Web page" />;
    case "YOUTUBE_VIDEO":
      return <Video className={cls} aria-label="YouTube video" />;
    case "YOUTUBE_PLAYLIST":
      return <ListVideo className={cls} aria-label="YouTube playlist" />;
  }
}

function StatusRow({ source, compact }: { source: Source; compact: boolean }) {
  // QUARANTINED is not one of the four display statuses on the enum, but the
  // pipeline status carries it; render it as its own explicit case so we never
  // fall through to a misleading "failed" message.
  if (source.status === "QUARANTINED") {
    return <QuarantinedRow compact={compact} />;
  }
  switch (source.displayStatus) {
    case "uploading":
      return (
        <div className="mt-2">
          <ServiceStatus severity="pending">Uploading</ServiceStatus>
        </div>
      );
    case "processing":
      return <ProcessingRow status={source.status} compact={compact} />;
    case "indexed":
      return (
        <div className="mt-2">
          <ServiceStatus severity="good">
            Indexed · {source.chunkCount.toLocaleString()}{" "}
            {source.chunkCount === 1 ? "chunk" : "chunks"}
          </ServiceStatus>
        </div>
      );
    case "failed":
      return <FailedRow source={source} compact={compact} />;
  }
}

/**
 * The ingestion pipeline is an ordered route, so it is drawn as one: named
 * stops with the current position marked. Every stop comes from the server's
 * own `status` value — nothing here is inferred from elapsed time, and the
 * route never advances on its own (CLAUDE.md §2.5.4).
 */
const STOPS = [
  { key: "queued", label: "Queued" },
  { key: "extracting", label: "Extracting" },
  { key: "scanning", label: "Scanning" },
  { key: "chunking", label: "Chunking" },
  { key: "indexing", label: "Indexing" },
] as const;

function stopIndex(status: Source["status"]): number {
  switch (status) {
    case "PENDING":
    case "UPLOADED":
      return 0;
    case "EXTRACTING":
    case "EXTRACTED":
      return 1;
    case "SCANNING":
      return 2;
    case "CHUNKING":
    case "CHUNKED":
      return 3;
    case "INDEXING":
      return 4;
    case "READY":
    case "QUARANTINED":
    case "FAILED":
      return STOPS.length;
  }
}

function ProcessingRow({ status, compact }: { status: Source["status"]; compact: boolean }) {
  const current = stopIndex(status);
  const label = STOPS[Math.min(current, STOPS.length - 1)]?.label ?? "Processing";

  return (
    <div className="mt-2 space-y-1.5">
      <ServiceStatus severity="working" active>
        {label}
      </ServiceStatus>
      {!compact && (
        <ol className="flex items-center gap-1" aria-label={`Step ${current + 1} of ${STOPS.length}: ${label}`}>
          {STOPS.map((stop, i) => {
            const done = i < current;
            const here = i === current;
            return (
              <li key={stop.key} className="flex flex-1 items-center gap-1">
                <span
                  aria-hidden
                  className={cn(
                    "h-[3px] flex-1 rounded-full transition-colors",
                    done || here
                      ? "bg-[var(--color-line-amber)]"
                      : "bg-[var(--color-border)]",
                  )}
                />
                <span
                  aria-hidden
                  className={cn(
                    "h-2 w-2 flex-none rounded-full border-2",
                    here
                      ? "border-[var(--color-line-amber)] bg-[var(--color-line-amber)]"
                      : done
                        ? "border-[var(--color-line-amber)] bg-transparent"
                        : "border-[var(--color-border)] bg-transparent",
                  )}
                />
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function FailedRow({ source, compact }: { source: Source; compact: boolean }) {
  const retry = useRetrySource();
  const message = failureMessage(source);
  // Contract v1.2.0 inlines `failure` on the list rows. The retry endpoint
  // answers SOURCE_NOT_READY for anything with `retryable: false`, so the
  // control only exists when the server says a retry can succeed.
  const canRetry = source.failure?.retryable === true;
  return (
    <div className="mt-2 space-y-2">
      <ServiceStatus severity="down">Failed</ServiceStatus>
      <p className={cn("text-[var(--color-fg-muted)]", compact ? "text-[0.6875rem]" : "text-xs")}>
        {message}
      </p>
      {!canRetry && !compact && (
        <p className="text-xs text-[var(--color-fg-muted)]">
          This one can&rsquo;t be retried automatically. Remove it and add it again, or try a
          different source.
        </p>
      )}
      {canRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            retry
              .mutateAsync({ workspaceId: source.workspaceId, sourceId: source.id })
              .then(() => toast.success("Retry queued."))
              .catch((err: unknown) => {
                if (toast.isApiError(err)) toast.error(err, "Retry failed");
              })
          }
          disabled={retry.isPending}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${retry.isPending ? "animate-spin" : ""}`}
            aria-hidden
          />
          {retry.isPending ? "Retrying…" : "Retry"}
        </Button>
      )}
    </div>
  );
}

function QuarantinedRow({ compact }: { compact: boolean }) {
  return (
    <div className="mt-2 space-y-1.5">
      <ServiceStatus severity="held">Quarantined — not indexed</ServiceStatus>
      {!compact && (
        <p className="text-xs leading-relaxed text-[var(--color-fg-muted)]">
          This file contained content that resembled instructions aimed at the assistant, so it
          was set aside rather than indexed. The flagged text is deliberately not shown here.
        </p>
      )}
    </div>
  );
}

function DownloadButton({ source }: { source: Source }) {
  const download = useDownloadSource();
  async function open() {
    try {
      const res = await download.mutateAsync({ sourceId: source.id });
      // Signed URL expires in ~5 min — must be requested at click time.
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      if (toast.isApiError(err)) toast.error(err, "Download failed");
    }
  }
  return (
    <button
      type="button"
      onClick={() => void open()}
      aria-label={`Download ${source.title}`}
      disabled={download.isPending}
      className="rounded-[var(--radius-control)] p-1.5 text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)] disabled:opacity-50"
    >
      <Download className="h-4 w-4" aria-hidden />
    </button>
  );
}

function isDownloadable(source: Source): boolean {
  return (
    (source.type === "PDF" || source.type === "TEXT" || source.type === "VTT") &&
    source.mediaId !== null
  );
}

function failureMessage(source: Source): string {
  // Contract v1.2.0: the list endpoint inlines `failure`, so the card can
  // show the real reason instead of a generic line.
  return source.failure?.message ?? `Processing failed for "${source.title}".`;
}
