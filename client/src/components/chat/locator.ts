import type { Citation } from "@/contract/sse-events";

/**
 * Human-readable label for a citation locator. Switches on `kind` exhaustively:
 * per CLIENT-PLAN §4.4, never string-match a locator.
 */
export function locatorLabel(loc: Citation["locator"]): string {
  switch (loc.kind) {
    case "pdf_page":
      return `p.${loc.page}`;
    case "timestamp":
      return formatTimestamp(loc.startMs);
    case "text_range":
      return `§${loc.startChar}`;
    case "web":
      return loc.section ? `§ ${loc.section}` : "web";
  }
}

export function formatTimestamp(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
