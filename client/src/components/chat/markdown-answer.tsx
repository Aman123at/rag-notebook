"use client";

import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Citation, WebCitation } from "@/contract/sse-events";
import { CitationMarker } from "./citation-marker";

// Model output is untrusted (§CLAUDE.md 2.5.3): sanitise, no raw HTML, no
// javascript: URLs, images only from an allowlist of hosts.
const IMAGE_HOST_ALLOWLIST = new Set(["i.ytimg.com", "img.youtube.com"]);

const sanitizeSchema: typeof defaultSchema = {
  ...defaultSchema,
  protocols: {
    ...(defaultSchema.protocols ?? {}),
    href: ["http", "https", "mailto"],
    src: ["http", "https"],
  },
  tagNames: (defaultSchema.tagNames ?? []).filter(
    (t) => t !== "iframe" && t !== "script" && t !== "style",
  ),
};

const MARKER_RE = /\[(W?\d+)\]/g;

interface Props {
  content: string;
  citations: Citation[];
  webCitations: WebCitation[];
}

/**
 * Renders streaming markdown with resolvable citation markers.
 *
 * The stream is tolerant of mid-token gibberish: react-markdown accepts
 * partial input (unclosed fences, half-written tables, dangling `[`) and
 * simply renders what it can; the sanitiser then strips anything unsafe. The
 * caller batches token flushes on rAF to keep frames stable.
 *
 * `[n]` / `[Wn]` markers in the text are intercepted at the text-node level
 * (via a `components.p` override) and replaced with interactive citation
 * chips resolved against the citations array that arrived before any token.
 */
export function MarkdownAnswer({ content, citations, webCitations }: Props) {
  const byIndex = React.useMemo(() => {
    const src = new Map<number, Citation>();
    for (const c of citations) src.set(c.index, c);
    const web = new Map<number, WebCitation>();
    for (const c of webCitations) web.set(c.index, c);
    return { src, web };
  }, [citations, webCitations]);

  /**
   * The strongest retrieval score in this answer's own citation set. Station
   * details show strength relative to this, never as an absolute — the
   * contract gives `score` no stated range.
   */
  const peerMaxScore = React.useMemo(() => {
    let max = 0;
    for (const c of citations) if (c.score > max) max = c.score;
    return max > 0 ? max : undefined;
  }, [citations]);

  const renderText = React.useCallback(
    (text: string): React.ReactNode[] => {
      const out: React.ReactNode[] = [];
      let last = 0;
      MARKER_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = MARKER_RE.exec(text)) !== null) {
        if (match.index > last) out.push(text.slice(last, match.index));
        const token = match[1] ?? "";
        if (token === "") continue;
        if (token.startsWith("W")) {
          const idx = Number.parseInt(token.slice(1), 10);
          const web = byIndex.web.get(idx);
          out.push(
            web ? (
              <CitationMarker key={`w-${match.index}`} kind="web" citation={web} />
            ) : (
              <span key={`w-${match.index}`} className="font-mono text-[var(--color-fg-muted)]">
                [{token}]
              </span>
            ),
          );
        } else {
          const idx = Number.parseInt(token, 10);
          const src = byIndex.src.get(idx);
          out.push(
            src ? (
              <CitationMarker
                key={`s-${match.index}`}
                kind="source"
                citation={src}
                peerMaxScore={peerMaxScore}
              />
            ) : (
              <span key={`s-${match.index}`} className="font-mono text-[var(--color-fg-muted)]">
                [{token}]
              </span>
            ),
          );
        }
        last = match.index + match[0].length;
      }
      if (last < text.length) out.push(text.slice(last));
      return out;
    },
    [byIndex, peerMaxScore],
  );

  const components = React.useMemo<Components>(
    () => ({
      a: ({ href, children, ...rest }) => (
        <a
          {...rest}
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[var(--color-line-cobalt-text)] underline underline-offset-4 decoration-[color-mix(in_oklab,currentColor_45%,transparent)] hover:decoration-current"
        >
          {children}
        </a>
      ),
      img: ({ src, alt }) => {
        if (typeof src !== "string") return null;
        try {
          const url = new URL(src);
          if (!IMAGE_HOST_ALLOWLIST.has(url.hostname)) return null;
        } catch {
          return null;
        }
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={src} alt={alt ?? ""} className="my-3 max-w-full rounded" />;
      },
      code: ({ className, children, ...rest }) => {
        const isBlock = /language-/.test(className ?? "");
        if (isBlock) {
          return (
            <pre className="my-3 overflow-x-auto rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-well)] p-3 text-xs">
              <code {...rest} className={className}>
                {children}
              </code>
            </pre>
          );
        }
        return (
          <code
            {...rest}
            className="rounded bg-[var(--color-surface-2)] px-1 py-0.5 font-mono text-[0.85em]"
          >
            {children}
          </code>
        );
      },
      p: ({ children }) => <p className="my-2">{renderChildrenWithMarkers(children, renderText)}</p>,
      li: ({ children }) => <li className="my-1">{renderChildrenWithMarkers(children, renderText)}</li>,
    }),
    [renderText],
  );

  return (
    <div className="prose-content font-body text-[var(--color-fg)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function renderChildrenWithMarkers(
  children: React.ReactNode,
  renderText: (text: string) => React.ReactNode[],
): React.ReactNode {
  return React.Children.map(children, (child, i) => {
    if (typeof child === "string") return <React.Fragment key={i}>{renderText(child)}</React.Fragment>;
    return child;
  });
}
