import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Roundel } from "@/components/ui/roundel";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#limits", label: "Free limits" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_82%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
        {/* The roundel, not a lettered tile: the app header already wears the
            network mark, and a visitor who signs up should not meet a second,
            unrelated logo on the other side of the door. */}
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-[var(--radius-control)] text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-fg)]"
        >
          <Roundel size={22} className="text-[var(--color-line-cobalt-text)]" />
          RAG Notebook
        </Link>

        <nav aria-label="Main" className="hidden flex-1 md:block">
          <ul className="flex items-center gap-6 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Show when="signed-out">
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-up">Start free</Link>
            </Button>
          </Show>
          <Show when="signed-in">
            <Button asChild variant="ghost" size="sm">
              <Link href="/app">Back to chat</Link>
            </Button>
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
}
