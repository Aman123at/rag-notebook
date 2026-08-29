import { Check, PlayCircle } from "lucide-react";
import { LineBadge } from "@/components/ui/chassis";
import type { LineInk } from "@/lib/lines";

/**
 * A static picture of the playlist roadmap, drawn with the same vocabulary the
 * roadmap route itself uses: the progress banner from `roadmap-view`, then
 * numbered stations on the course's line from `module-card`. It is an
 * illustration, not a live session — the decorative chrome is `aria-hidden`
 * and the whole figure carries one description for assistive tech.
 *
 * Everything here is drawn from the shipped surface, so a visitor who adds a
 * playlist meets exactly this. The course itself is illustrative content, the
 * way the answer preview's sources are.
 */

/** The course runs on one line, the same way a source does everywhere else. */
const LINE: LineInk = {
  name: "teal",
  ink: "var(--color-line-teal)",
  mark: "var(--color-line-teal-text)",
  text: "var(--color-line-teal-text)",
};

const TOTAL = 12;
const PASSED = 7;

const CONCEPTS = ["Log replication", "Terms", "Quorum"] as const;
const VIDEOS = ["Raft, part 1 — the replicated log", "Raft, part 2 — leader change"] as const;

export function RoadmapPreview() {
  return (
    <figure
      role="img"
      aria-label="A YouTube playlist laid out as a numbered route: twelve modules on one line, seven passed, each station carrying its objective, its length, and the videos it covers."
      className="space-y-4"
    >
      {/* ------------------------------------------------------- The banner */}
      <div aria-hidden="true" className="chassis space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <LineBadge line={LINE} label="Distributed systems" className="min-w-0" />
          <span className="tabular shrink-0 font-mono text-xs text-[var(--color-fg-muted)]">
            58%
          </span>
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm text-[var(--color-fg)]">
            <span className="tabular font-mono">{PASSED}</span> of{" "}
            <span className="tabular font-mono">{TOTAL}</span> stations passed
          </p>
          <p className="text-xs text-[var(--color-fg-muted)]">
            1 hr 25 min left of 3 hr 20 min
          </p>
        </div>

        <div className="flex items-center gap-[3px]">
          {Array.from({ length: TOTAL }, (_, i) => (
            <span
              key={i}
              className="h-[var(--spine-width)] flex-1 rounded-full"
              style={{
                backgroundColor: i < PASSED ? LINE.mark : "var(--color-border)",
              }}
            />
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------ The stations */}
      <ol aria-hidden="true">
        <Station order={7} state="done" isFirst>
          <StationHead title="Leader election" minutes={22} state="done" />
        </Station>

        <Station order={8} state="current">
          <StationHead title="Consensus with Raft" minutes={34} state="current" />

          <p className="text-sm leading-relaxed text-[var(--color-fg)]">
            Explain how a cluster keeps one agreed log across failures, and what
            happens the moment the leader stops answering.
          </p>

          <div>
            <span className="label-track">Key concepts</span>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {CONCEPTS.map((concept) => (
                <li
                  key={concept}
                  className="rounded-[var(--radius-tick)] border border-[var(--color-border)] bg-[var(--color-well)] px-2.5 py-0.5 text-xs text-[var(--color-fg)]"
                >
                  {concept}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-0.5 border-t border-[var(--color-border)] pt-3">
            <span className="label-track">2 videos</span>
            <ul className="space-y-0.5 pt-1">
              {VIDEOS.map((title) => (
                <li
                  key={title}
                  className="flex items-center gap-2 px-1.5 py-1.5 text-sm text-[var(--color-fg)]"
                >
                  <PlayCircle
                    className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{title}</span>
                </li>
              ))}
            </ul>
          </div>
        </Station>

        <Station order={9} state="ahead" isLast>
          <StationHead title="Replication and quorums" minutes={28} state="ahead" />
        </Station>
      </ol>
    </figure>
  );
}

type State = "done" | "current" | "ahead";

/**
 * One station: the numbered marker, the line running through the gutter
 * behind it — in the course's ink up to where the reader stopped — and the
 * card beside it.
 */
function Station({
  order,
  state,
  isFirst = false,
  isLast = false,
  children,
}: {
  order: number;
  state: State;
  isFirst?: boolean;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  const travelled = state === "done";
  // The marker is 32px tall at the top of the row, so its centre — where the
  // line has to start or stop — is 16px down.
  const top = isFirst ? 16 : 0;

  return (
    <li className="relative pb-4 pl-12 last:pb-0">
      <span
        className="absolute left-[14.5px] w-[var(--spine-width)]"
        style={{
          top,
          ...(isLast ? { height: `${16 - top}px` } : { bottom: 0 }),
          backgroundColor: travelled ? LINE.mark : "var(--color-border)",
        }}
      />
      <StationMarker order={order} state={state} />

      <div
        className="chassis space-y-3 p-4"
        style={
          state === "current" ? { borderColor: LINE.text } : undefined
        }
      >
        {children}
      </div>
    </li>
  );
}

/** The title row: name, running time, and the completion control's resting state. */
function StationHead({
  title,
  minutes,
  state,
}: {
  title: string;
  minutes: number;
  state: State;
}) {
  const complete = state === "done";
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3
          className={
            complete
              ? "font-display text-base font-semibold text-[var(--color-fg-muted)] line-through"
              : "font-display text-base font-semibold text-[var(--color-fg)]"
          }
        >
          {title}
        </h3>
        <p className="tabular mt-1 font-mono text-[0.6875rem] tracking-[0.06em] text-[var(--color-fg-muted)]">
          {minutes} min
        </p>
      </div>

      <span
        className={
          complete
            ? "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-line-green-text)] px-3 py-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-[var(--color-line-green-text)]"
            : "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-3 py-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-[var(--color-fg)]"
        }
      >
        {complete ? (
          <Check className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <span aria-hidden className="h-3 w-3 rounded-full border-[1.5px] border-current" />
        )}
        {complete ? "Completed" : "Mark complete"}
      </span>
    </div>
  );
}

/**
 * The numbered station. Filled once passed, ringed in the line's ink where the
 * reader is now, a plain porcelain ring for stations still ahead. The number
 * stays in every state — on this route the order is the information.
 */
function StationMarker({ order, state }: { order: number; state: State }) {
  // `border-[var(--spine-width)]` is ambiguous to Tailwind, which resolves it
  // as a COLOUR and leaves the width at 0, so the width goes inline.
  const ring: React.CSSProperties = {
    borderWidth: "var(--spine-width)",
    borderStyle: "solid",
  };
  const style: React.CSSProperties =
    state === "done"
      ? {
          ...ring,
          backgroundColor: LINE.mark,
          borderColor: LINE.mark,
          color: "var(--color-enamel)",
        }
      : state === "current"
        ? {
            ...ring,
            backgroundColor: "var(--color-bg)",
            borderColor: LINE.mark,
            color: LINE.text,
          }
        : {
            ...ring,
            backgroundColor: "var(--color-bg)",
            borderColor: "var(--color-border-strong)",
            color: "var(--color-fg-muted)",
          };

  return (
    <span
      className="tabular absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full font-mono text-xs font-semibold"
      style={style}
    >
      {order}
    </span>
  );
}
