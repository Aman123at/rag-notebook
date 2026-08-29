/**
 * Line allocation.
 *
 * In this design a source is a transit line, so every source needs a stable
 * ink. Allocation is a pure function of the source id: no storage, no server
 * field, identical on the server and the client (so it cannot cause a
 * hydration mismatch), and stable across reloads.
 *
 * Eight inks. The free tier caps a workspace at 7 sources, so a free user
 * never sees a repeat; past that the palette cycles, and the line badge's
 * text is what disambiguates two sources sharing an ink.
 *
 * Each ink is a PAIR. `ink` is for strokes, fills, dots and badges. `text` is
 * the lightened tint used the moment the ink carries a label — raw scarlet is
 * 3.89:1 on the enamel ground and raw cobalt is 3.49:1, both of which fail as
 * text. Ratios are recorded in src/app/globals.css.
 */

export const LINE_NAMES = [
  "scarlet",
  "cobalt",
  "amber",
  "green",
  "violet",
  "teal",
  "orange",
  "magenta",
] as const;

export type LineName = (typeof LINE_NAMES)[number];

export interface LineInk {
  /** Stable ink name, e.g. "scarlet". Also the accessible line label. */
  readonly name: LineName;
  /** Saturated ink. Large fills and marks on the enamel ground only. */
  readonly ink: string;
  /**
   * Marks — spines, legend rules, dots — that sit on a RAISED surface.
   *
   * Measured, not assumed: raw cobalt is 2.91:1 against `--color-surface-2`
   * and simply disappears there, which is exactly what shipped before this
   * was fixed. Every tint clears 5.4:1 on the same surface, so line marks use
   * the tint and the saturated ink is reserved for the enamel ground.
   */
  readonly mark: string;
  /** Text set in this line's colour. Always ≥6.5:1 on enamel. */
  readonly text: string;
}

const INKS: readonly LineInk[] = LINE_NAMES.map((name) => ({
  name,
  ink: `var(--color-line-${name})`,
  mark: `var(--color-line-${name}-text)`,
  text: `var(--color-line-${name}-text)`,
}));

/**
 * FNV-1a. Small, dependency-free, and stable across runtimes — the point is
 * determinism, not cryptographic strength.
 */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The ink for a source id. Same id always yields the same line. */
export function lineForSource(sourceId: string): LineInk {
  const ink = INKS[hash(sourceId) % INKS.length];
  // noUncheckedIndexedAccess: the modulo guarantees a hit, but the compiler
  // cannot know that, and INKS is never empty.
  return (
    ink ?? {
      name: "cobalt",
      ink: "var(--color-line-cobalt)",
      mark: "var(--color-line-cobalt-text)",
      text: "var(--color-line-cobalt-text)",
    }
  );
}

/**
 * Inline custom properties for an element that should carry a line's ink.
 * Used with the `.route-spine` and station-tick styles in globals.css.
 */
export function lineStyle(line: LineInk): React.CSSProperties {
  return {
    ["--spine-ink" as string]: line.mark,
    ["--station-ink" as string]: line.ink,
    ["--station-ink-text" as string]: line.text,
  };
}

/**
 * Web-retrieved evidence is not part of the workspace's network, so it gets
 * no line ink — it is drawn as a dashed out-of-network route instead.
 */
export const OFF_NETWORK_STYLE: React.CSSProperties = {
  ["--spine-ink" as string]: "var(--color-offnet)",
  ["--station-ink" as string]: "var(--color-offnet)",
  ["--station-ink-text" as string]: "var(--color-offnet)",
};
