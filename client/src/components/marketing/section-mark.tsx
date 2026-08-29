import { cn } from "@/lib/utils";

/**
 * A section marker, drawn as a station on a line.
 *
 * It carries the section's ink and nothing else. It used to carry the section
 * name in tracked caps as well, which — whatever the intent — renders as a
 * kicker: a category word sitting above a heading that already says the same
 * thing in full sentences. The word is gone; the wayfinding is not. What is
 * left is the line entering the section, which is the only part that was ever
 * doing work.
 */
export function SectionMark({
  ink = "var(--color-line-cobalt-text)",
  className,
}: {
  ink?: string;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn("flex items-center gap-2", className)}>
      <span
        className="h-2.5 w-2.5 flex-none rounded-full border-2"
        style={{ borderColor: ink, backgroundColor: "var(--color-bg)" }}
      />
      <span
        className="h-[2px] w-14 flex-none rounded-full"
        style={{ backgroundColor: ink }}
      />
    </span>
  );
}
