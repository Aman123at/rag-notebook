"use client";

import type { Citation, WebCitation } from "@/contract/sse-events";
import { lineForSource, lineStyle, OFF_NETWORK_STYLE, type LineInk } from "@/lib/lines";
import { RouteSpine, FieldLabel, LineBadge } from "@/components/ui/chassis";
import { locatorLabel } from "./locator";

interface Props {
  citations: Citation[];
  webCitations: WebCitation[];
}

/**
 * The route strip — the board's own component, and the place where the whole
 * design pays off.
 *
 * An answer is a journey. This strip is the route it took: one spine per
 * source, in that source's ink, with every passage the retriever actually used
 * drawn on it as a station, in the order the answer cited them. Web evidence
 * gets a dashed out-of-network spine, because it is not one of the user's own
 * sources and should never look like one.
 *
 * Every station is a link to the exact page or timestamp. Citation is the
 * product, so this is not a footnote list — it is the answer's provenance,
 * legible at a glance.
 */
export function ReferencesStrip({ citations, webCitations }: Props) {
  if (citations.length === 0 && webCitations.length === 0) return null;

  const bySource = new Map<string, { id: string; title: string; items: Citation[] }>();
  for (const c of citations) {
    const existing = bySource.get(c.sourceId);
    if (existing) existing.items.push(c);
    else bySource.set(c.sourceId, { id: c.sourceId, title: c.sourceTitle, items: [c] });
  }
  const routes = [...bySource.values()];

  return (
    <aside className="mt-4 border-t border-[var(--color-border)] pt-3">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <FieldLabel>Sources used</FieldLabel>
        {/* The count used to be `routes.length sources` over the total stops,
            which meant an answer built entirely from the web reported
            "0 sources · 2 passages" directly above two visible web references.
            The two channels are counted separately now, and a channel that
            contributed nothing is not mentioned at all. */}
        <span className="tabular font-mono text-[10px] text-[var(--color-fg-muted)]">
          {[
            routes.length > 0 &&
              `${routes.length} ${routes.length === 1 ? "source" : "sources"} \u00b7 ${citations.length} ${citations.length === 1 ? "passage" : "passages"}`,
            webCitations.length > 0 &&
              `${webCitations.length} from the web`,
          ]
            .filter(Boolean)
            .join(" \u00b7 ")}
        </span>
      </div>
      <ul className="space-y-3">
        {routes.map((route) => (
          <Route key={route.id} route={route} line={lineForSource(route.id)} />
        ))}
        {webCitations.length > 0 ? <WebRoute citations={webCitations} /> : null}
      </ul>
    </aside>
  );
}

function Route({
  route,
  line,
}: {
  route: { id: string; title: string; items: Citation[] };
  line: LineInk;
}) {
  return (
    <li>
      <RouteSpine line={line} className="space-y-2">
        <LineBadge line={line} label={route.title} />
        {/* Stations run DOWN the line, one row each, so the spine has real
            height to draw and the strip reads as the route the answer took.
            They used to wrap as a row of pills, which left a 24px stub of
            colour standing in for the whole idea. Each stop carries the
            passage the retriever actually used, because that passage is the
            thing the product exists to let someone check. */}
        <ul className="space-y-2" style={lineStyle(line)}>
          {route.items.map((c) => (
            <li key={c.chunkId} className="route-stop">
              <a
                href={c.deepLink ?? "#"}
                target={c.deepLink ? "_blank" : undefined}
                rel="noreferrer noopener"
                className="group block"
                aria-label={`${route.title}, ${locatorLabel(c.locator)}`}
              >
                <span
                  className="station-tag"
                  style={{ borderColor: line.mark, color: line.text }}
                >
                  {locatorLabel(c.locator)}
                </span>
                {c.snippet ? (
                  <span className="mt-1 block max-w-[68ch] text-xs leading-relaxed text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg)]">
                    {truncate(c.snippet, 180)}
                  </span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      </RouteSpine>
    </li>
  );
}

/** Snippets are model-adjacent text from the user's own documents; they are
 *  rendered as plain text, never as markup. */
function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}\u2026`;
}

/**
 * Web results ride a dashed line and carry the page title, not a bare [W1] —
 * "where did this come from" is the one question a web citation must answer
 * without a hover.
 */
function WebRoute({ citations }: { citations: WebCitation[] }) {
  return (
    <li>
      <RouteSpine offNetwork className="space-y-1.5">
        <FieldLabel className="text-[var(--color-offnet)]">From the web</FieldLabel>
        <ul className="space-y-2" style={OFF_NETWORK_STYLE}>
          {citations.map((w) => (
            <li key={w.index} className="route-stop min-w-0">
              <a
                href={w.url}
                target="_blank"
                rel="noreferrer noopener"
                data-offnet="true"
                className="group block min-w-0"
                title={w.url}
              >
                <span
                  className="station-tag max-w-full"
                  style={{ borderColor: "var(--color-offnet)", color: "var(--color-offnet)" }}
                >
                  <span className="truncate">{w.title}</span>
                </span>
                {w.snippet ? (
                  <span className="mt-1 block max-w-[68ch] text-xs leading-relaxed text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg)]">
                    {truncate(w.snippet, 180)}
                  </span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      </RouteSpine>
    </li>
  );
}
