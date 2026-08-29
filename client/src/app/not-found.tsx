import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Roundel } from "@/components/ui/roundel";

/**
 * 404 — not a disruption, so it gets no severity ink and no alert frame. The
 * network is running; this address simply isn't a stop on it. The page says
 * that plainly and points at the two places that are.
 */
export default function NotFound() {
  return (
    <main id="main" className="relative flex min-h-screen items-center px-4 py-16 sm:px-6">
      <div aria-hidden className="enamel-watermark pointer-events-none absolute inset-0" />

      <div className="relative mx-auto w-full max-w-xl space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-fg)]"
        >
          <Roundel size={24} className="text-[var(--color-line-cobalt-text)]" />
          RAG Notebook
        </Link>

        <div className="chassis space-y-4 p-5 sm:p-6">
          {/* The line the address would have sat on, drawn as it actually is:
              a route that runs past this point without calling here. The tick
              is hollow, unfilled, unnamed — the same mark the roadmap uses for
              a stop the line never reaches. */}
          <div aria-hidden className="flex items-center gap-2">
            <span className="h-[3px] w-6 flex-none rounded-full bg-[var(--color-border-strong)] sm:w-10" />
            <span className="h-3 w-3 flex-none rounded-full border-2 border-[var(--color-border-strong)] bg-[var(--color-bg)]" />
            <span className="h-[3px] flex-1 rounded-full bg-[var(--color-border-strong)]" />
            <span className="tabular flex-none font-mono text-xs tracking-[0.08em] text-[var(--color-fg-muted)]">
              404
            </span>
          </div>

          <h1 className="text-balance text-xl sm:text-2xl">
            This address isn’t a stop on the network.
          </h1>

          <div className="space-y-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
            <p>
              The link may be old, or the workspace or source it pointed at was
              deleted. Nothing is broken — this page has simply never existed.
            </p>

            <div className="flex flex-col gap-3 pt-1 sm:flex-row">
              {/* Both destinations render for everyone, deliberately. Reading
                  the session here (Clerk's <Show>) would make this page dynamic,
                  and because the root not-found sits in every route's tree, it
                  took the whole app off static rendering with it — measured in
                  `pnpm build`, not assumed. A signed-out visitor who picks
                  "Your workspaces" lands on sign-in, which is where they were
                  going anyway. */}
              <Button asChild>
                <Link href="/">Back to the start</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/app">Your workspaces</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
