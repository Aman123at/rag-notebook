"use client";

import { Roundel } from "@/components/ui/roundel";
import { FieldLabel, GroupedNumber } from "@/components/ui/chassis";
import type { Me } from "@/hooks/use-current-user";

/**
 * The fare card.
 *
 * Quota on a transit network is a stored-value travel card: it names the ticket
 * type you hold, what is left on it, and what you have spent. Drawn as an
 * object rather than a form field, because that is what it is.
 *
 * Snapshot of the token state from GET /me. Refetch /me after any operation
 * that spends tokens — this is a picture, not a live meter (CLAUDE.md §5.5),
 * and the card says so rather than implying otherwise.
 */
export function TokenSummary({ me }: { me: Me }) {
  const { assigned, remaining, usedEmbedding, usedCompletion } = me.tokens;
  const unlimited = assigned === null;
  const left = Math.max(0, remaining ?? 0);
  const leftPct = unlimited ? 100 : percentRemaining(remaining, assigned);
  const ink = unlimited ? BALANCE_INK.ample : balanceInk(remaining, assigned);

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-chassis)] border border-[var(--color-border)] bg-[var(--color-well)] p-5">
      <div aria-hidden className="enamel-watermark absolute inset-0" />

      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <Roundel size={22} className="text-[var(--color-fg-muted)]" />
          <TicketType tier={me.planTier} />
        </div>

        <div className="space-y-1">
          <FieldLabel>{unlimited ? "Balance" : "Tokens remaining"}</FieldLabel>
          {unlimited ? (
            <p className="font-display text-2xl text-[var(--color-fg)]">No cap on this plan</p>
          ) : (
            <p className="tabular font-mono text-3xl font-semibold" style={{ color: ink.text }}>
              <GroupedNumber value={left} />
              <span className="ml-2 font-body text-sm font-normal text-[var(--color-fg-muted)]">
                of <GroupedNumber value={assigned} />
              </span>
            </p>
          )}
        </div>

        {!unlimited && (
          <div className="space-y-1.5">
            <div
              className="h-[var(--spine-width)] w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--color-porcelain)_14%,transparent)]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={assigned}
              aria-valuenow={Math.min(assigned, left)}
              aria-label="Tokens remaining"
            >
              <div
                className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${leftPct}%`, backgroundColor: ink.mark }}
              />
            </div>
            <p className="text-xs" style={{ color: ink.text }}>
              {ink.note(leftPct)}
            </p>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-4 border-t border-[var(--color-border)] pt-4">
          <div>
            <dt className="label-track">Embedding</dt>
            <dd className="tabular mt-1 font-mono text-sm text-[var(--color-fg)]">
              <GroupedNumber value={usedEmbedding} />
            </dd>
          </div>
          <div>
            <dt className="label-track">Completion</dt>
            <dd className="tabular mt-1 font-mono text-sm text-[var(--color-fg)]">
              <GroupedNumber value={usedCompletion} />
            </dd>
          </div>
        </dl>

        <p className="text-xs text-[var(--color-fg-muted)]">
          Read at your last refresh. It updates after each chat.
        </p>
      </div>
    </div>
  );
}

/** The ticket type printed on the card. */
function TicketType({ tier }: { tier: Me["planTier"] }) {
  const ink =
    tier === "PRO"
      ? "var(--color-line-cobalt-text)"
      : tier === "CUSTOM"
        ? "var(--color-line-violet-text)"
        : "var(--color-porcelain-dim)";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-tick)] border px-2.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em]"
      style={{ borderColor: ink, color: ink }}
    >
      <span aria-hidden className="h-1.5 w-4 flex-none rounded-full" style={{ backgroundColor: ink }} />
      {tier}
    </span>
  );
}

interface BalanceInk {
  mark: string;
  text: string;
  note: (leftPct: number) => string;
}

/**
 * Balance runs through the severity register rather than a single accent: a
 * card that is nearly empty should say so in the colour the rest of the system
 * uses for "attention", and the note carries the same meaning in words so the
 * colour is never the only channel.
 */
const BALANCE_INK = {
  ample: {
    mark: "var(--color-line-cobalt-text)",
    text: "var(--color-fg-muted)",
    note: (p: number) => `${p}% left`,
  },
  low: {
    mark: "var(--color-line-amber-text)",
    text: "var(--color-line-amber-text)",
    note: (p: number) => `${p}% left — running low`,
  },
  empty: {
    mark: "var(--color-line-scarlet-text)",
    text: "var(--color-line-scarlet-text)",
    note: () => "Nothing left on this card",
  },
} as const satisfies Record<string, BalanceInk>;

function balanceInk(remaining: number | null, assigned: number): BalanceInk {
  const left = Math.max(0, remaining ?? 0);
  if (left <= 0) return BALANCE_INK.empty;
  if (assigned > 0 && left / assigned <= 0.15) return BALANCE_INK.low;
  return BALANCE_INK.ample;
}

/**
 * The bar and the headline must measure the same thing. The headline is what is
 * left on the card, so the bar drains rather than fills, and the note under it
 * is worded in the same direction.
 */
function percentRemaining(remaining: number | null, assigned: number): number {
  if (assigned <= 0) return 0;
  const left = Math.max(0, Math.min(assigned, remaining ?? 0));
  return Math.round((left / assigned) * 100);
}
