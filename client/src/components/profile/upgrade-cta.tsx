"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * The upgrade prompt beneath the fare card.
 *
 * It used to carry a 3px cobalt rule down its left edge, which was a spine
 * without stations — a coloured border-left on a callout, and nothing in the
 * product it could be a line *of*. A spine here would be a lie: no source
 * runs through an upgrade prompt. It is separated by a rule above it instead,
 * which is what it actually is — the next thing after the card.
 */
export function UpgradeCta() {
  return (
    <div
      className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--color-fg)]">Need more room?</p>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Pro lifts the token cap and raises your workspace and source limits.
        </p>
      </div>
      <Button asChild variant="primary" size="sm" className="shrink-0">
        <Link href="/pricing">See Pro plans</Link>
      </Button>
    </div>
  );
}
