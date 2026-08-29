import * as React from "react";
import { CheckCircle2, CircleDashed, AlertTriangle, ShieldAlert, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Service status — the network's own way of reporting a line's condition.
 *
 * Three channels on every state: an icon, a word, and a colour, in that order
 * of authority. A monochrome screenshot of this component must still be fully
 * readable, which is the acceptance test for the whole palette.
 *
 * `severity` is a presentation concern only. Ingestion status is server truth
 * (CLAUDE.md §2.5.4) and is never inferred from elapsed time here.
 */
export type ServiceSeverity = "good" | "working" | "pending" | "down" | "held";

const SEVERITY = {
  good: {
    icon: CheckCircle2,
    ink: "var(--color-line-green)",
    text: "var(--color-line-green-text)",
  },
  working: {
    icon: CircleDashed,
    ink: "var(--color-line-amber)",
    text: "var(--color-line-amber-text)",
  },
  pending: {
    icon: Upload,
    ink: "var(--color-porcelain-dim)",
    text: "var(--color-porcelain-dim)",
  },
  down: {
    icon: AlertTriangle,
    ink: "var(--color-line-scarlet)",
    text: "var(--color-line-scarlet-text)",
  },
  held: {
    icon: ShieldAlert,
    ink: "var(--color-line-violet)",
    text: "var(--color-line-violet-text)",
  },
} as const satisfies Record<
  ServiceSeverity,
  { icon: React.ElementType; ink: string; text: string }
>;

interface ServiceStatusProps {
  severity: ServiceSeverity;
  /** The word. Always present — colour never carries meaning alone. */
  children: React.ReactNode;
  /** Spins the icon for genuinely in-flight work. */
  active?: boolean;
  className?: string;
}

function ServiceStatus({ severity, children, active = false, className }: ServiceStatusProps) {
  const { icon: Icon, text } = SEVERITY[severity];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium", className)}
      style={{ color: text }}
    >
      <Icon
        className={cn("h-3.5 w-3.5 flex-none", active && "motion-safe:animate-spin")}
        aria-hidden
      />
      <span>{children}</span>
    </span>
  );
}

/**
 * The network-wide status block from the reference board: a tick, a headline
 * condition, and a plain-language second line.
 */
function SystemStatus({
  severity,
  headline,
  detail,
  className,
}: {
  severity: ServiceSeverity;
  headline: string;
  detail?: string;
  className?: string;
}) {
  const { ink } = SEVERITY[severity];
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="label-track flex items-center gap-2">
        <span
          aria-hidden
          className="h-2 w-2 flex-none rounded-full"
          style={{ backgroundColor: ink }}
        />
        System status
      </span>
      <span className="text-sm text-[var(--color-fg)]">{headline}</span>
      {detail ? <span className="text-xs text-[var(--color-fg-muted)]">{detail}</span> : null}
    </div>
  );
}

export { ServiceStatus, SystemStatus };
