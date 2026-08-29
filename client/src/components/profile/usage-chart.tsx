"use client";

import { GroupedNumber } from "@/components/ui/chassis";
import { useUsage, type Usage } from "@/hooks/use-usage";

const DAYS = 14;

/**
 * The spend ledger: what the fare card was spent on, day by day.
 */
export function UsageChart() {
  const usage = useUsage(DAYS);

  return (
    <section aria-labelledby="usage-heading" className="chassis space-y-4 p-5">
      <header className="space-y-1">
        <h2 id="usage-heading" className="font-display text-lg text-[var(--color-fg)]">
          Last {DAYS} days
        </h2>
        {/* The server returns only days that had activity, so a quiet fortnight
            is one column, not fourteen. Saying so stops that looking broken. */}
        <p className="text-sm leading-relaxed text-[var(--color-fg-muted)]">
          One column per day you used it — quiet days aren’t shown.
        </p>
      </header>

      {usage.isLoading && (
        <p role="status" className="flex items-center gap-3 text-sm text-[var(--color-fg-muted)]">
          <span className="arrivals-track" aria-hidden />
          Loading your spend
        </p>
      )}

      {usage.isError && (
        <div
          role="alert"
          className="space-y-1 py-1 pl-4 text-sm"
          style={{ borderLeft: "var(--spine-width) solid var(--color-line-scarlet-text)" }}
        >
          <p className="font-medium text-[var(--color-fg)]">Your spend couldn’t be loaded.</p>
          <p className="text-[var(--color-fg-muted)]">
            The rest of this page is unaffected. Reload to try again.
          </p>
        </div>
      )}

      {usage.data && <UsageBars data={usage.data} />}
    </section>
  );
}

function UsageBars({ data }: { data: Usage }) {
  const max = Math.max(1, ...data.days.map((d) => d.embeddingTokens + d.completionTokens));
  const isEmpty = data.days.every((d) => d.embeddingTokens + d.completionTokens === 0);

  if (isEmpty) {
    return (
      <div className="space-y-1">
        <p className="text-sm text-[var(--color-fg)]">No spend in this range.</p>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Ask a question in one of your workspaces and it will show up here.
        </p>
      </div>
    );
  }

  const first = data.days[0];
  const last = data.days[data.days.length - 1];
  const totalTokens = data.totals.embeddingTokens + data.totals.completionTokens;

  return (
    <div className="space-y-3">
      <div className="flex h-40 items-end gap-1">
        {data.days.map((day) => {
          const total = day.embeddingTokens + day.completionTokens;
          const heightPct = (total / max) * 100;
          const embedShare = total > 0 ? (day.embeddingTokens / total) * 100 : 0;
          return (
            /* `h-full` is load-bearing. A percentage height only resolves
               against a parent with a DEFINITE height, and `items-end` gives
               each column its content height instead — so without this the
               bars compute to zero and the chart renders empty. */
            <div
              key={day.date}
              className="flex h-full min-w-0 max-w-14 flex-1 flex-col justify-end"
            >
              <div
                className="flex w-full flex-col-reverse overflow-hidden rounded-[var(--radius-tick)] bg-[color-mix(in_oklab,var(--color-porcelain)_10%,transparent)]"
                style={{ height: `${Math.max(2, heightPct)}%` }}
                role="img"
                aria-label={`${formatDay(day.date)}: ${day.embeddingTokens.toLocaleString()} embedding, ${day.completionTokens.toLocaleString()} completion, ${day.messageCount} ${day.messageCount === 1 ? "message" : "messages"}`}
                title={`${formatDay(day.date)} · ${day.embeddingTokens.toLocaleString()} embedding · ${day.completionTokens.toLocaleString()} completion · ${day.messageCount} ${day.messageCount === 1 ? "message" : "messages"}`}
              >
                <div
                  className="w-full bg-[var(--color-line-cobalt-text)]"
                  style={{ height: `${embedShare}%` }}
                />
                <div
                  className="w-full bg-[var(--color-line-amber-text)]"
                  style={{ height: `${100 - embedShare}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Without these the columns are unlabelled and the reader cannot tell
          which end of the range is today. The server returns only days that
          had activity, so a single-day range is normal — printing the same
          date at both ends would read as a bug. */}
      {first && last && (
        <div className="tabular flex justify-between font-mono text-[0.625rem] text-[var(--color-fg-muted)]">
          <span>{formatDay(first.date)}</span>
          {first.date === last.date ? null : <span>{formatDay(last.date)}</span>}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[var(--color-border)] pt-3 text-xs">
        <div className="flex gap-4">
          <LegendKey ink="var(--color-line-cobalt-text)">Embedding</LegendKey>
          <LegendKey ink="var(--color-line-amber-text)">Completion</LegendKey>
        </div>
        <p className="text-[var(--color-fg-muted)]">
          <span className="tabular font-mono text-[var(--color-fg)]">
            <GroupedNumber value={totalTokens} />
          </span>{" "}
          tokens across{" "}
          <span className="tabular font-mono text-[var(--color-fg)]">
            <GroupedNumber value={data.totals.messageCount} />
          </span>{" "}
          {data.totals.messageCount === 1 ? "message" : "messages"}
        </p>
      </div>
    </div>
  );
}

function LegendKey({ ink, children }: { ink: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[var(--color-fg-muted)]">
      <span
        aria-hidden
        className="inline-block h-1.5 w-4 flex-none rounded-full"
        style={{ backgroundColor: ink }}
      />
      {children}
    </span>
  );
}

/** `2026-08-27` → `27 Aug`. Parsed as UTC so the label never slips a day. */
function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
