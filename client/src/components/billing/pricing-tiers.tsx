"use client";

import { useUser } from "@clerk/nextjs";
import { usePlans } from "@/hooks/use-plans";
import { useCurrentUser } from "@/hooks/use-current-user";
import { TierCard } from "./tier-card";

const TIER_ORDER: Array<"FREE" | "PRO" | "CUSTOM"> = ["FREE", "PRO", "CUSTOM"];

export function PricingTiers() {
  const plans = usePlans();
  const { isSignedIn, isLoaded } = useUser();
  const me = useCurrentUser();

  if (plans.isLoading || !isLoaded) {
    return (
      <p role="status" className="flex items-center gap-3 text-sm text-[var(--color-fg-muted)]">
        <span className="arrivals-track" aria-hidden />
        Loading plans
      </p>
    );
  }
  if (plans.isError || !plans.data) {
    return (
      <div
        role="alert"
        className="chassis space-y-2 p-5 text-sm"
        style={{ borderLeft: "var(--spine-width) solid var(--color-line-scarlet-text)" }}
      >
        <p className="font-medium text-[var(--color-fg)]">Plans couldn’t be loaded.</p>
        <p className="text-[var(--color-fg-muted)]">
          Prices come from our billing service, so nothing is shown rather than
          something wrong. Reload to try again.
        </p>
      </div>
    );
  }
  if (plans.data.length === 0) {
    return (
      <p role="status" className="text-sm text-[var(--color-fg-muted)]">
        No plans are on sale right now.
      </p>
    );
  }

  const ordered = [...plans.data].sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
  );
  const currentTier = isSignedIn ? (me.data?.planTier ?? null) : null;

  return (
    <div className="grid items-stretch gap-4 md:grid-cols-3">
      {ordered.map((plan) => (
        <TierCard
          key={plan.tier}
          plan={plan}
          currentTier={currentTier}
          isSignedIn={Boolean(isSignedIn)}
        />
      ))}
    </div>
  );
}
