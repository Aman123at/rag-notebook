import * as React from "react";
import { cn } from "@/lib/utils";
import { lineStyle, OFF_NETWORK_STYLE, type LineInk } from "@/lib/lines";

/**
 * The system's enclosure: a porcelain hairline over raised enamel. Elevation
 * is declared once, as a border — never a border and a shadow together.
 */
const Chassis = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("chassis", className)} {...props} />
  ),
);
Chassis.displayName = "Chassis";

/**
 * A label in the wayfinding register: small, tracked, caps. Use for field
 * labels and column headers — never as a kicker above a heading.
 */
function FieldLabel({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("label-track", className)} {...props} />;
}

interface LineBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  line: LineInk;
  /** The source's real title. The badge always carries plain product language. */
  label: string;
}

/**
 * The line badge, e.g. RED LINE on the reference board — here it names the
 * actual source. Colour identifies; the text is what the user reads.
 */
function LineBadge({ line, label, className, ...props }: LineBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius-tick)]",
        "px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em]",
        "border",
        className,
      )}
      style={{
        borderColor: line.mark,
        color: line.text,
        backgroundColor: `color-mix(in oklab, ${line.ink} 22%, transparent)`,
      }}
      {...props}
    >
      <span
        aria-hidden
        className="h-1.5 w-4 flex-none rounded-full"
        style={{ backgroundColor: line.mark }}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

interface StationTickProps {
  active?: boolean;
  /** An interchange is a station where two sources genuinely meet. */
  interchange?: boolean;
  className?: string;
}

/** A porcelain ring sitting on the line; filled when active. */
function StationTick({ active = false, interchange = false, className }: StationTickProps) {
  return (
    <span
      aria-hidden
      className={cn("station-tick", className)}
      data-active={active ? "true" : "false"}
      data-interchange={interchange ? "true" : "false"}
    />
  );
}

interface RouteSpineProps extends React.HTMLAttributes<HTMLDivElement> {
  line?: LineInk;
  /** Web-retrieved evidence: drawn dashed, outside the workspace network. */
  offNetwork?: boolean;
}

/**
 * A line running down a block of content, with station ticks on it. This is
 * the world's core geometry — it always represents a real line, and it always
 * carries ticks, which is what separates it from a coloured border.
 */
function RouteSpine({ line, offNetwork = false, className, style, ...props }: RouteSpineProps) {
  const inkStyle = offNetwork ? OFF_NETWORK_STYLE : line ? lineStyle(line) : {};
  return (
    <div
      className={cn("route-spine", className)}
      data-offnet={offNetwork ? "true" : "false"}
      style={{ ...inkStyle, ...style }}
      {...props}
    />
  );
}

/**
 * A grouped number set in the mono face.
 *
 * Spline Sans Mono gives the comma a full character advance, so at display
 * sizes "847,783" reads as "847 ,783" — two tokens with a gap where a
 * separator should be. The digits stay monospaced and tabular, which is what
 * the system asks for; only the separator's advance is pulled in.
 */
function GroupedNumber({ value, className }: { value: number; className?: string }) {
  const parts = value.toLocaleString("en-US").split(",");
  return (
    <span className={cn("tabular", className)}>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span aria-hidden className="mx-[-0.14em] inline-block">
              ,
            </span>
          )}
          {part}
        </React.Fragment>
      ))}
    </span>
  );
}

export { Chassis, FieldLabel, LineBadge, StationTick, RouteSpine, GroupedNumber };
