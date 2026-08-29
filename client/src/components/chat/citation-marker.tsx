"use client";

import * as React from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { Citation, WebCitation } from "@/contract/sse-events";
import { lineForSource, lineStyle, OFF_NETWORK_STYLE } from "@/lib/lines";
import { CitationPreview } from "./citation-preview";
import { StationHeader, RetrievalStrength, OpenAction } from "./station-detail";
import { locatorLabel } from "./locator";

interface SourceCitationProps {
  kind: "source";
  citation: Citation;
  /**
   * Highest retrieval score among the citations returned for this same
   * answer. Retrieval strength is shown as a share of it, never as an
   * absolute — see `RetrievalStrength`.
   */
  peerMaxScore?: number | undefined;
}
interface WebMarkerProps {
  kind: "web";
  citation: WebCitation;
}

type Props = SourceCitationProps | WebMarkerProps;

/**
 * Inline citation marker — a station on the source's line.
 *
 * The marker takes the ink of the source it came from, so the colour naming a
 * line in the route strip below is the same colour naming it mid-sentence. Web
 * evidence carries no line ink at all: it is drawn out-of-network in porcelain
 * grey, which is how a reader tells "from my documents" from "from the web"
 * without reading a word.
 *
 * Hover / focus opens the station detail. Click opens the deep link (PDF page,
 * YouTube timestamp, or web URL).
 */
export function CitationMarker(props: Props) {
  const label =
    props.kind === "source" ? locatorLabel(props.citation.locator) : `W${props.citation.index}`;
  const href =
    props.kind === "source"
      ? (props.citation.deepLink ?? deepLinkFromLocator(props.citation))
      : props.citation.url;

  const youTube = props.kind === "source" ? youTubeInfo(props.citation) : null;
  const supportsFilePreview =
    props.kind === "source" &&
    (props.citation.locator.kind === "pdf_page" || props.citation.locator.kind === "text_range");
  const [open, setOpen] = React.useState(false);

  const ink = props.kind === "source" ? lineStyle(lineForSource(props.citation.sourceId)) : OFF_NETWORK_STYLE;

  const trigger = (
    <a
      href={href ?? "#"}
      target={href ? "_blank" : undefined}
      rel="noreferrer noopener"
      style={ink}
      className="citation-marker inline-flex items-baseline whitespace-nowrap no-underline"
      aria-label={
        props.kind === "source"
          ? `Citation ${props.citation.index}: ${props.citation.sourceTitle}, ${label}`
          : `Web citation ${props.citation.index}: ${props.citation.title}`
      }
    >
      {/* No brackets: the tick and the line's own ink already mark this as a
          citation, and [ ] on top of both is a third notation doing the same
          job. The full source and locator are in the aria-label. */}
      <sup className="text-[0.72em] leading-none">{label}</sup>
    </a>
  );

  return (
    <Tooltip.Root delayDuration={120} open={open} onOpenChange={setOpen}>
      <Tooltip.Trigger asChild>{trigger}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="bottom"
          align="start"
          sideOffset={6}
          /* A station detail with a video in it is taller than the space above
             OR below a citation in a short viewport, and Radix does not shrink
             content on its own — it flips, then overflows the top of the
             window, taking the header with it. `--radix-popper-available-height`
             (verified in @radix-ui/react-popper 1.3.7) is the real budget for
             the chosen side; the card scrolls inside it rather than escaping. */
          collisionPadding={12}
          /* The content renders in a portal, so it does not inherit the
             trigger's ink — the line's custom properties are set again here. */
          style={ink}
          className="route-draw z-50 max-h-[var(--radix-popper-available-height)] max-w-md overflow-y-auto rounded-[var(--radius-chassis)] border border-[var(--color-border)] bg-[var(--color-well)] p-3 text-xs text-[var(--color-fg)]"
        >
          {props.kind === "source" && youTube ? (
            <YouTubePreview
              citation={props.citation}
              videoId={youTube.videoId}
              startSec={youTube.startSec}
              href={href}
              peerMaxScore={props.peerMaxScore}
            />
          ) : props.kind === "source" && supportsFilePreview ? (
            <CitationPreview
              citation={props.citation}
              open={open}
              peerMaxScore={props.peerMaxScore}
            />
          ) : props.kind === "source" ? (
            <SourcePreview citation={props.citation} peerMaxScore={props.peerMaxScore} />
          ) : (
            <WebPreview citation={props.citation} />
          )}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function youTubeInfo(c: Citation): { videoId: string; startSec: number } | null {
  if (c.locator.kind !== "timestamp") return null;
  if (!c.locator.videoId) return null;
  return {
    videoId: c.locator.videoId,
    startSec: Math.max(0, Math.floor(c.locator.startMs / 1000)),
  };
}

function YouTubePreview({
  citation,
  videoId,
  startSec,
  href,
  peerMaxScore,
}: {
  citation: Citation;
  videoId: string;
  startSec: number;
  href: string | null;
  peerMaxScore: number | undefined;
}) {
  const embedSrc = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?start=${startSec}&rel=0&modestbranding=1&playsinline=1`;
  const watchUrl = href ?? `https://www.youtube.com/watch?v=${videoId}&t=${startSec}s`;
  const timeLabel = locatorLabel(citation.locator);

  const openInNewWindow = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(watchUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="w-[320px] space-y-2">
      <StationHeader
        sourceId={citation.sourceId}
        sourceTitle={citation.sourceTitle}
        locator={timeLabel}
      />
      <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-control)] bg-black">
        <iframe
          src={embedSrc}
          title={`${citation.sourceTitle} at ${timeLabel}`}
          className="absolute inset-0 h-full w-full"
          allow="encrypted-media; picture-in-picture"
          loading="lazy"
        />
        <button
          type="button"
          onClick={openInNewWindow}
          className="absolute inset-0 z-10 cursor-pointer bg-transparent"
          aria-label={`Open ${citation.sourceTitle} on YouTube at ${timeLabel} in a new window`}
        />
      </div>
      {citation.snippet ? <p className="text-[var(--color-fg-muted)]">{citation.snippet}</p> : null}
      <RetrievalStrength score={citation.score} peerMaxScore={peerMaxScore} />
      <OpenAction>Play on YouTube</OpenAction>
    </div>
  );
}

function SourcePreview({
  citation,
  peerMaxScore,
}: {
  citation: Citation;
  peerMaxScore: number | undefined;
}) {
  const action = openLabel(citation);
  return (
    <div className="w-[320px] space-y-2">
      <StationHeader
        sourceId={citation.sourceId}
        sourceTitle={citation.sourceTitle}
        locator={locatorLabel(citation.locator)}
      />
      <p className="text-[var(--color-fg-muted)]">{citation.snippet}</p>
      <RetrievalStrength score={citation.score} peerMaxScore={peerMaxScore} />
      {action ? <OpenAction>{action}</OpenAction> : null}
    </div>
  );
}

function WebPreview({ citation }: { citation: WebCitation }) {
  return (
    <div className="w-[320px] space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-sm font-medium">{citation.title}</span>
        <span className="label-track shrink-0 text-[var(--color-offnet)]">Web</span>
      </div>
      <p className="text-[var(--color-fg-muted)]">{citation.snippet}</p>
      <p className="truncate font-mono text-[10px] text-[var(--color-offnet)]">{citation.url}</p>
      <OpenAction>Open page</OpenAction>
    </div>
  );
}

function openLabel(c: Citation): string | null {
  switch (c.locator.kind) {
    case "pdf_page":
      return `Open PDF at page ${c.locator.page}`;
    case "timestamp":
      return `Play from ${locatorLabel(c.locator)}`;
    case "text_range":
      return "Open source";
    case "web":
      return "Open page";
  }
}

/**
 * Fallback deep link when the server omitted `deepLink`. Only computed for the
 * cases where the shape carries enough information (YouTube timestamps, web
 * URLs). PDFs and text ranges rely on the server-provided link.
 */
function deepLinkFromLocator(c: Citation): string | null {
  switch (c.locator.kind) {
    case "timestamp":
      if (c.locator.videoId !== undefined) {
        const t = Math.floor(c.locator.startMs / 1000);
        return `https://www.youtube.com/watch?v=${c.locator.videoId}&t=${t}s`;
      }
      return null;
    case "web":
      return c.locator.url;
    case "pdf_page":
    case "text_range":
      return null;
  }
}
