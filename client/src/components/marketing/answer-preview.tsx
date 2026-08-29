import { FileText, Video, Globe } from "lucide-react";

/**
 * A static illustration of a cited answer. It is a picture of the product, not
 * a live session — hence `aria-hidden` on the decorative chrome and a single
 * descriptive label for assistive tech.
 *
 * It is drawn with the product's real citation vocabulary: each source runs on
 * its own line ink, the inline markers are station tags in that ink, and the
 * strip beneath is the route strip. What a visitor sees here is what the chat
 * actually renders — the landing page demonstrates the mechanism rather than
 * illustrating an idealised version of it.
 */
const SOURCES = [
  {
    icon: FileText,
    label: "Q3-report.pdf",
    meta: "p. 14",
    ink: "var(--color-line-orange-text)",
  },
  {
    icon: Video,
    label: "Design review",
    meta: "12:04",
    ink: "var(--color-line-teal-text)",
  },
  {
    icon: Globe,
    label: "docs.stripe.com",
    meta: "§ 2",
    ink: "var(--color-line-violet-text)",
  },
] as const;

function Marker({ ink, children }: { ink: string; children: React.ReactNode }) {
  return (
    <span className="citation-marker" style={{ ["--station-ink-text" as string]: ink }}>
      <sup className="text-[0.72em] leading-none">{children}</sup>
    </span>
  );
}

export function AnswerPreview() {
  return (
    <figure
      role="img"
      aria-label="A RAG Notebook answer with each sentence linked to the page or timestamp it came from."
      className="chassis overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-well)] px-4 py-2.5"
      >
        <span className="tabular font-mono text-[11px] tracking-[0.06em] text-[var(--color-fg-muted)]">
          Q3 planning &middot; 3 sources
        </span>
        <span className="ml-auto flex items-center gap-1" aria-hidden>
          {SOURCES.map((s) => (
            <span
              key={s.label}
              className="h-1.5 w-5 rounded-full"
              style={{ backgroundColor: s.ink }}
            />
          ))}
        </span>
      </div>

      <div aria-hidden="true" className="space-y-5 p-5 sm:p-6">
        <p className="ml-auto w-fit max-w-[85%] rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-well)] px-3.5 py-2 text-sm text-[var(--color-fg)]">
          What did we commit to for renewals this quarter?
        </p>

        <div className="space-y-3 text-sm leading-relaxed">
          <p>
            Renewals move to a 45-day outreach window
            <Marker ink={SOURCES[0].ink}>p.&nbsp;14</Marker>, down from 60. The
            design review confirmed the in-app reminder ships alongside it
            <Marker ink={SOURCES[1].ink}>12:04</Marker>, and dunning stays on the
            existing retry schedule
            <Marker ink={SOURCES[2].ink}>&sect;&nbsp;2</Marker>.
          </p>
          <p className="text-[var(--color-fg-muted)]">
            Nothing in these sources covers pricing changes.
          </p>
        </div>

        <div className="space-y-2 border-t border-[var(--color-border)] pt-4">
          <span className="label-track">Sources used</span>
          <ul className="space-y-1.5">
            {SOURCES.map(({ icon: Icon, label, meta, ink }) => (
              <li
                key={label}
                className="route-spine flex items-center gap-2 py-1 font-mono text-[11px]"
                style={{ ["--spine-ink" as string]: ink }}
              >
                <Icon className="h-3.5 w-3.5 flex-none" style={{ color: ink }} />
                <span className="min-w-0 flex-1 truncate text-[var(--color-fg)]">{label}</span>
                <span className="station-tag flex-none" style={{ color: ink, borderColor: ink }}>
                  {meta}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </figure>
  );
}
