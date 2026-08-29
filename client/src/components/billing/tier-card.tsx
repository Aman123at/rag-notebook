"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/chassis";
import { cn } from "@/lib/utils";
import type { Plan } from "@/hooks/use-plans";
import { UpgradeButton } from "./upgrade-button";

interface Props {
  plan: Plan;
  currentTier: "FREE" | "PRO" | "CUSTOM" | null;
  isSignedIn: boolean;
}

/**
 * A ticket type. Each tier carries its own ink — the same three inks the fare
 * card uses for the ticket printed on it — so the plan you hold and the plan
 * you are reading about are recognisably the same object.
 */
const TIER_INK: Record<"FREE" | "PRO" | "CUSTOM", string> = {
  FREE: "var(--color-porcelain-dim)",
  PRO: "var(--color-line-cobalt-text)",
  CUSTOM: "var(--color-line-violet-text)",
};

export function TierCard({ plan, currentTier, isSignedIn }: Props) {
  const isCurrent = currentTier === plan.tier;
  const ink = TIER_INK[plan.tier];
  const featured = plan.tier === "PRO";

  return (
    <article
      aria-labelledby={`tier-${plan.tier}-name`}
      /* Elevation is declared once. The featured tier gains a RING — the
         system's active convention — not a second border plus a shadow. */
      className={cn("chassis flex h-full flex-col gap-6 p-6", featured && "border-transparent")}
      style={featured ? { boxShadow: `0 0 0 1px ${ink}` } : undefined}
    >
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          {/* Ink AND word, in one element. Two earlier versions of this card
              were both wrong: the first said the tier's name twice, once in
              this pill and again in the heading below it; the second dropped
              the word and left a bare dash, which made colour the only channel
              carrying the tier — the one thing this system forbids outright,
              and invisible in monochrome. The pill is the heading now, so the
              name is said once, in the wayfinding register, beside its ink. */}
          <h3
            id={`tier-${plan.tier}-name`}
            className="inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]"
            style={{ color: ink }}
          >
            <span
              aria-hidden
              className="h-1.5 w-8 flex-none rounded-full"
              style={{ backgroundColor: ink }}
            />
            {plan.displayName}
          </h3>
          {isCurrent && <FieldLabel>Your plan</FieldLabel>}
        </div>

        <div className="text-sm">{renderPrice(plan)}</div>
      </header>

      <ul className="flex-1 space-y-2.5 text-sm">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check className="mt-[3px] h-4 w-4 shrink-0" style={{ color: ink }} aria-hidden />
            <span className="text-[var(--color-fg)]">{feature}</span>
          </li>
        ))}
      </ul>

      <TierAction plan={plan} isCurrent={isCurrent} isSignedIn={isSignedIn} />
    </article>
  );
}

function TierAction({
  plan,
  isCurrent,
  isSignedIn,
}: {
  plan: Plan;
  isCurrent: boolean;
  isSignedIn: boolean;
}) {
  if (plan.tier === "CUSTOM") {
    // Contact-only card — never a code path that sets it (brief §1).
    return (
      <Button asChild variant="secondary" size="md">
        <a href="mailto:sales@ragnotebook.app?subject=Custom%20plan%20enquiry">Contact sales</a>
      </Button>
    );
  }

  if (plan.tier === "FREE") {
    if (isCurrent) {
      return (
        <Button type="button" variant="secondary" size="md" disabled>
          Your current plan
        </Button>
      );
    }
    if (!isSignedIn) {
      return (
        <Button asChild variant="secondary" size="md">
          <Link href="/sign-up">Start free</Link>
        </Button>
      );
    }
    // Signed-in Pro user looking at Free — no downgrade flow in C5.
    return (
      <p className="text-sm text-[var(--color-fg-muted)]">Included with every account.</p>
    );
  }

  return <UpgradeButton className="w-full" />;
}

function renderPrice(plan: Plan): React.ReactNode {
  if (plan.limits.contactOnly) {
    return <span className="text-[var(--color-fg-muted)]">Custom pricing</span>;
  }
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="tabular font-display text-3xl text-[var(--color-fg)]">
        {formatMoney(plan.priceCents, plan.currency)}
      </span>
      {plan.interval && (
        <span className="text-sm text-[var(--color-fg-muted)]">/ {plan.interval}</span>
      )}
    </span>
  );
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(0)}`;
  }
}
