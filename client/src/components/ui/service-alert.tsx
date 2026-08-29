"use client";

import * as React from "react";
import { ServiceStatus, type ServiceSeverity } from "@/components/ui/service-status";
import { cn } from "@/lib/utils";

/**
 * The service alert — how this network reports a disruption.
 *
 * A departure board does not apologise and it does not hide the cause. It says
 * which service is affected, how bad it is, and what the traveller can do. So
 * every failure surface here carries the same four things in the same order:
 * the severity (icon and word, never colour alone), the part of the network
 * affected, a plain sentence naming the cause, and the recovery.
 *
 * The spine down the leading edge is the same disruption mark the chat and the
 * roadmap already draw — this is that pattern, made shareable for the page-
 * level boundaries, where the alert IS the screen rather than a row inside it.
 */

const INK: Record<ServiceSeverity, string> = {
  good: "var(--color-line-green-text)",
  working: "var(--color-line-amber-text)",
  pending: "var(--color-porcelain-dim)",
  down: "var(--color-line-scarlet-text)",
  held: "var(--color-line-violet-text)",
};

interface ServiceAlertProps {
  severity: ServiceSeverity;
  /** The condition, in a word or two: "Service disrupted", "Held". */
  status: string;
  /**
   * What is affected — a route, a screen, a stage. Set in mono, because it is
   * a locator: the reader may need to quote it to support.
   */
  affected?: string;
  heading: string;
  /** Heading level, so a boundary inside the app shell doesn't claim the h1. */
  headingAs?: "h1" | "h2";
  children: React.ReactNode;
  className?: string;
}

export function ServiceAlert({
  severity,
  status,
  affected,
  heading,
  headingAs: Heading = "h1",
  children,
  className,
}: ServiceAlertProps) {
  return (
    <section
      role="alert"
      className={cn("chassis space-y-4 p-5 sm:p-6", className)}
      style={{ borderLeft: `var(--spine-width) solid ${INK[severity]}` }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <ServiceStatus severity={severity}>{status}</ServiceStatus>
        {affected ? (
          <>
            <span aria-hidden className="text-xs text-[var(--color-border-strong)]">
              &middot;
            </span>
            <span className="tabular min-w-0 truncate font-mono text-xs text-[var(--color-fg-muted)]">
              {affected}
            </span>
          </>
        ) : null}
      </div>

      <Heading className="text-balance text-xl sm:text-2xl">{heading}</Heading>

      <div className="space-y-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        {children}
      </div>
    </section>
  );
}

/**
 * The request id, shown and copyable — never a bare string the reader has to
 * select by hand at the exact moment they are already annoyed.
 *
 * The clipboard is not guaranteed: it throws in an insecure context and can be
 * blocked outright. When it fails the row says so and points at the id, which
 * stays selectable either way — an unusable "Copy" that silently does nothing
 * is worse than no button.
 */
export function RequestIdRow({ id, label = "Request id" }: { id: string; label?: string }) {
  const [state, setState] = React.useState<"idle" | "copied" | "failed">("idle");

  React.useEffect(() => {
    if (state !== "copied") return;
    const t = window.setTimeout(() => setState("idle"), 2400);
    return () => window.clearTimeout(t);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="space-y-1.5 border-t border-[var(--color-border)] pt-4">
      <span className="label-track">{label}</span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <code className="tabular min-w-0 break-all font-mono text-xs text-[var(--color-fg)]">
          {id}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className={cn(
            "rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-2.5 py-1",
            "text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-[var(--color-fg)]",
            "transition-colors duration-150 ease-out hover:bg-[var(--color-surface-2)]",
            "motion-reduce:transition-none",
          )}
        >
          {state === "copied" ? "Copied" : "Copy"}
        </button>
      </div>
      <p aria-live="polite" className="text-xs text-[var(--color-fg-muted)]">
        {state === "copied"
          ? "Request id copied."
          : state === "failed"
            ? "Couldn’t reach the clipboard — select the id above and copy it."
            : ""}
      </p>
    </div>
  );
}
