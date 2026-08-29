import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { WorkspaceRail } from "@/components/workspace/workspace-rail";
import { RailDrawer } from "@/components/workspace/rail-drawer";
import { AppNav } from "@/components/app/app-nav";
import { Roundel } from "@/components/ui/roundel";

/**
 * Persistent app shell — the station concourse. The rail lives here so it does
 * not remount as the user navigates between networks.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-[var(--color-bg)]">
      <header className="relative z-30 flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          {/* The wordmark is hidden on the narrowest screens so it never wraps
              to two lines beside the mark. `hidden` also takes it out of the
              accessibility tree, so the link is named explicitly — otherwise it
              would announce as a bare "link" on a phone. */}
          <Link
            href="/app"
            aria-label="RAG Notebook — home"
            className="flex min-w-0 items-center gap-2.5 text-[var(--color-fg)]"
          >
            <Roundel className="flex-none text-[var(--color-line-cobalt-text)]" />
            <span
              aria-hidden
              className="hidden truncate whitespace-nowrap font-display text-sm uppercase tracking-[0.1em] sm:inline"
            >
              RAG Notebook
            </span>
          </Link>
          <RailDrawer />
        </div>
        <div className="flex items-center gap-2">
          <AppNav />
          <UserButton />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[290px] shrink-0 md:block">
          <WorkspaceRail />
        </aside>
        {/* The shell is `h-screen`, so the page itself must never grow the
            document — otherwise scrolling a long route (the roadmap) scrolls
            the rail and header away with it. Content scrolls here instead. */}
        <main id="main" className="min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
