"use client";

import * as React from "react";
import { useSourcePreview, type SourcePreview } from "@/hooks/use-source-preview";
import type { Citation } from "@/hooks/use-messages";
import { StationHeader, RetrievalStrength, OpenAction } from "./station-detail";
import { locatorLabel } from "./locator";

/**
 * Threshold under which we render the PDF inline with PDF.js (with a
 * text-layer highlight over the cited passage). Above it, we fall back
 * to a plain `<iframe src="…#page=N">` — the browser's own PDF viewer
 * jumps to the page but cannot draw an in-file highlight.
 *
 * 200 KB is the ceiling the user chose; PDF.js parse + render for that
 * size finishes in well under a second on modern hardware.
 */
const PDFJS_MAX_BYTES = 200 * 1024;

interface CitationPreviewProps {
  citation: Citation;
  /** Controls the query enable — only fetch when the popover actually opens. */
  open: boolean;
  /** Strongest score among this answer's citations. See `RetrievalStrength`. */
  peerMaxScore?: number | undefined;
}

/**
 * Rich hover-card body for PDF / TEXT / VTT citations.
 *
 * For text citations we fetch the full source text and wrap the exact
 * `[startChar, endChar)` range in `<mark>`, scrolling that mark into
 * view so the reader lands on the passage the retriever pulled.
 *
 * For PDFs under {@link PDFJS_MAX_BYTES} we render page N with PDF.js
 * (canvas + text layer, highlight class applied to text runs that
 * contain the snippet keywords); above the threshold we hand off to
 * the browser's built-in PDF viewer via `#page=N`.
 */
export function CitationPreview({ citation, open, peerMaxScore }: CitationPreviewProps) {
  const { data, isLoading, isError } = useSourcePreview(
    citation.sourceId,
    citation.chunkId,
    open,
  );

  if (isLoading) {
    return (
      <div className="flex h-40 w-[420px] flex-col items-center justify-center gap-2.5">
        <span
          aria-hidden
          className="arrivals-track"
          style={{ ["--arrivals-ink" as string]: "var(--station-ink-text)" }}
        />
        <span className="label-track">Loading the passage</span>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="w-[320px] space-y-2 text-xs">
        <StationHeader
          sourceId={citation.sourceId}
          sourceTitle={citation.sourceTitle}
          locator={locatorLabel(citation.locator)}
        />
        <p className="text-[var(--color-fg-muted)]">{citation.snippet}</p>
        <p className="text-[var(--color-line-amber-text)]">
          The full passage couldn&rsquo;t be loaded. The snippet above is the text the
          answer was grounded in.
        </p>
      </div>
    );
  }

  if (data.contentType === "pdf") {
    return <PdfPreview citation={citation} preview={data} peerMaxScore={peerMaxScore} />;
  }
  return <TextPreview citation={citation} preview={data} peerMaxScore={peerMaxScore} />;
}

// ---------------------------------------------------------------------------
// PDF branch
// ---------------------------------------------------------------------------

function PdfPreview({
  citation,
  preview,
  peerMaxScore,
}: {
  citation: Citation;
  preview: Extract<SourcePreview, { contentType: "pdf" }>;
  peerMaxScore: number | undefined;
}) {
  const inline = preview.sizeBytes > 0 && preview.sizeBytes <= PDFJS_MAX_BYTES;
  const openUrl = `${preview.signedUrl}#page=${preview.page}`;

  return (
    <div className="w-[440px] space-y-2 text-xs">
      <StationHeader
        sourceId={citation.sourceId}
        sourceTitle={citation.sourceTitle}
        locator={`p.${preview.page}`}
      />
      {inline ? (
        <PdfInline
          signedUrl={preview.signedUrl}
          page={preview.page}
          snippet={preview.snippet}
        />
      ) : (
        <IframePdf openUrl={openUrl} title={`${citation.sourceTitle} — p.${preview.page}`} />
      )}
      <p className="text-[var(--color-fg-muted)]">{preview.snippet}</p>
      <RetrievalStrength score={citation.score} peerMaxScore={peerMaxScore} />
      <a href={openUrl} target="_blank" rel="noreferrer noopener" className="block">
        <OpenAction>Open PDF at page {preview.page}</OpenAction>
      </a>
    </div>
  );
}

function IframePdf({ openUrl, title }: { openUrl: string; title: string }) {
  return (
    <div className="relative h-[300px] w-full overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white">
      <iframe
        src={openUrl}
        title={title}
        className="absolute inset-0 h-full w-full"
        loading="lazy"
      />
    </div>
  );
}

/**
 * PDF.js render — dynamic-imported so the ~300KB worker bundle stays out
 * of the initial page. Renders one page to a canvas, overlays a
 * transparent text layer, and marks any text run matching the snippet.
 */
function PdfInline({
  signedUrl,
  page,
  snippet,
}: {
  signedUrl: string;
  page: number;
  snippet: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = React.useRef<HTMLDivElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let renderTask: { promise: Promise<void>; cancel: () => void } | null = null;
    let loadingTask: PdfLoadingTask | null = null;

    async function render() {
      try {
        // Dynamic import: pdfjs-dist is heavy and worker setup only makes
        // sense on the client. Cast the module to a minimal typed surface;
        // the full pdfjs types don't bring anything the caller needs.
        const pdfjs = (await import("pdfjs-dist")) as unknown as PdfJsModule;
        // Wire the worker via the pinned esm build. Only set once — pdfjs
        // reads GlobalWorkerOptions.workerSrc when a document loads.
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          // CDN-hosted worker keeps the client build simple — no
          // next.config asset copy step, no `?url` loader typing. The
          // version is pinned to what we bundled so the parse behaviour
          // matches.
          pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        }

        loadingTask = pdfjs.getDocument({ url: signedUrl });
        const doc = await loadingTask.promise;
        if (cancelled) {
          void loadingTask.destroy();
          return;
        }
        const pdfPage = await doc.getPage(page);
        if (cancelled) {
          void loadingTask.destroy();
          return;
        }

        const canvas = canvasRef.current;
        const textLayer = textLayerRef.current;
        if (!canvas || !textLayer) {
          void loadingTask.destroy();
          return;
        }
        // Scale to fit the popover width (420px content area).
        const unscaled = pdfPage.getViewport({ scale: 1 });
        const scale = 420 / unscaled.width;
        const viewport = pdfPage.getViewport({ scale });

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          void loadingTask.destroy();
          return;
        }
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        renderTask = pdfPage.render({ canvasContext: ctx, viewport, canvas });
        await renderTask.promise;
        if (cancelled) {
          void loadingTask.destroy();
          return;
        }

        // Text layer: overlay selectable text and mark the snippet.
        textLayer.innerHTML = "";
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;
        const textContent = await pdfPage.getTextContent();
        const layer = new pdfjs.TextLayer({
          textContentSource: textContent,
          container: textLayer,
          viewport,
        });
        await layer.render();
        highlightSnippet(textLayer, snippet);

        void loadingTask.destroy();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }
    void render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
      // Release the worker/document even if we unmount mid-load, which the
      // previous teardown leaked on every popover close.
      void loadingTask?.destroy();
    };
  }, [signedUrl, page, snippet]);

  if (error) {
    return (
      <div className="h-40 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] p-3 text-[10px] text-[var(--color-fg-muted)]">
        Inline preview failed — {error}
      </div>
    );
  }
  return (
    <div className="relative mx-auto overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white">
      <canvas ref={canvasRef} className="block" />
      <div
        ref={textLayerRef}
        className="citation-text-layer pointer-events-none absolute inset-0"
        aria-hidden
      />
    </div>
  );
}

/**
 * Walk the rendered text-layer divs and highlight any run whose text
 * appears inside the snippet (or vice versa). This is intentionally
 * fuzzy — text-layer runs are split on font/style changes, so an exact
 * substring match rarely spans one node.
 */
function highlightSnippet(container: HTMLElement, snippet: string): void {
  if (!snippet.trim()) return;
  const needles = snippet
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter((w) => w.length >= 4);
  if (needles.length === 0) return;
  const spans = container.querySelectorAll<HTMLElement>("span");
  spans.forEach((span) => {
    const text = span.textContent ?? "";
    if (!text.trim()) return;
    const lower = text.toLowerCase();
    if (needles.some((n) => lower.includes(n.toLowerCase()))) {
      span.classList.add("citation-highlight");
    }
  });
}

// ---------------------------------------------------------------------------
// Text / VTT branch
// ---------------------------------------------------------------------------

function TextPreview({
  citation,
  preview,
  peerMaxScore,
}: {
  citation: Citation;
  preview: Extract<SourcePreview, { contentType: "text" | "vtt" }>;
  peerMaxScore: number | undefined;
}) {
  const markRef = React.useRef<HTMLElement | null>(null);
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const mark = markRef.current;
    const scroller = scrollerRef.current;
    if (!mark || !scroller) return;
    const markTop = mark.offsetTop;
    scroller.scrollTop = Math.max(0, markTop - scroller.clientHeight / 3);
  }, [preview.text, preview.highlight.startChar, preview.highlight.endChar]);

  const { text, highlight } = preview;
  const before = text.slice(0, highlight.startChar);
  const inside = text.slice(highlight.startChar, highlight.endChar);
  const after = text.slice(highlight.endChar);

  return (
    <div className="w-[440px] space-y-2 text-xs">
      <StationHeader
        sourceId={citation.sourceId}
        sourceTitle={citation.sourceTitle}
        locator={`${preview.contentType.toUpperCase()} · ${highlight.startChar.toLocaleString()}\u2013${highlight.endChar.toLocaleString()}`}
      />
      <div
        ref={scrollerRef}
        className="h-[280px] overflow-auto rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-well)] p-3 font-mono text-[11px] whitespace-pre-wrap"
      >
        {before}
        <mark
          ref={markRef}
          className="citation-highlight rounded-[2px] bg-[var(--color-citation-surface)] px-[1px] text-[var(--color-fg)]"
        >
          {inside}
        </mark>
        {after}
      </div>
      <RetrievalStrength score={citation.score} peerMaxScore={peerMaxScore} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Minimal pdfjs typed surface — only what this component calls.
// Real signatures verified against
// node_modules/pdfjs-dist/types/src/pdf.d.ts and
// node_modules/pdfjs-dist/types/src/display/{api,text_layer}.d.ts.
// ---------------------------------------------------------------------------

interface PdfJsModule {
  version: string;
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { url: string }): PdfLoadingTask;
  TextLayer: new (opts: {
    textContentSource: unknown;
    container: HTMLElement;
    viewport: PdfViewport;
  }) => { render(): Promise<unknown> };
}
/**
 * `PDFDocumentLoadingTask` owns teardown — `PDFDocumentProxy` has no
 * `destroy()` in pdfjs-dist 6.x. Verified against
 * node_modules/pdfjs-dist/types/src/display/api.d.ts (`destroy(): Promise<void>`
 * on the loading task; no such member on the document proxy).
 */
interface PdfLoadingTask {
  promise: Promise<PdfDoc>;
  destroy(): Promise<void>;
}
interface PdfDoc {
  getPage(n: number): Promise<PdfPage>;
}
interface PdfViewport {
  width: number;
  height: number;
}
interface PdfPage {
  getViewport(opts: { scale: number }): PdfViewport;
  render(opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
    canvas: HTMLCanvasElement;
  }): { promise: Promise<void>; cancel(): void };
  getTextContent(): Promise<unknown>;
}
