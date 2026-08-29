import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Roundel } from "@/components/ui/roundel";

/**
 * The frame both signed-out pages sit in: the enamel ground with its network
 * watermark, the mark and a way back on the left, and the Clerk card on the
 * right. The card carries the step ("Sign in", "Verify your email"), so this
 * side never repeats it — it holds the one thing the card cannot say, which is
 * what the reader is signing in to and what it costs.
 */
export function AuthFrame({
  headline,
  children,
  aside,
}: {
  headline: string;
  /** The Clerk component. */
  children: React.ReactNode;
  /** One honest fact under the headline — real numbers only. */
  aside: React.ReactNode;
}) {
  return (
    <main
      id="main"
      className="relative flex min-h-screen items-center justify-center px-4 py-12 sm:px-6"
    >
      <div aria-hidden className="enamel-watermark pointer-events-none absolute inset-0" />

      <div className="relative grid w-full max-w-4xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="space-y-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-fg)]"
          >
            <Roundel size={26} className="text-[var(--color-line-cobalt-text)]" />
            RAG Notebook
          </Link>

          <h1 className="text-balance text-3xl leading-[1.12] sm:text-4xl">{headline}</h1>

          <div className="max-w-md text-sm leading-relaxed text-[var(--color-fg-muted)]">
            {aside}
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)] motion-reduce:transition-none"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            Back to the landing page
          </Link>
        </div>

        <div className="flex w-full justify-center lg:justify-end">{children}</div>
      </div>
    </main>
  );
}
