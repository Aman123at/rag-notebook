import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { Roundel } from "@/components/ui/roundel";

const PRODUCT_LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#limits", label: "Free limits" },
  { href: "/pricing", label: "Pricing" },
] as const;

const linkClass =
  "rounded-[var(--radius-control)] text-[var(--color-fg-muted)] underline-offset-4 transition-colors hover:text-[var(--color-fg)] hover:underline";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--color-border)]">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-3">
          <p className="flex items-center gap-2.5 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-fg)]">
            <Roundel size={22} className="text-[var(--color-line-cobalt-text)]" />
            RAG Notebook
          </p>
          <p className="max-w-xs text-sm text-[var(--color-fg-muted)]">
            Ask your PDFs, videos, and web sources — and read the exact passage
            behind every answer.
          </p>
        </div>

        <nav aria-label="Product">
          <h2 className="label-track">
            Product
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {PRODUCT_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Account">
          <h2 className="label-track">
            Account
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <Show when="signed-out">
              <li>
                <Link href="/sign-up" className={linkClass}>
                  Create an account
                </Link>
              </li>
              <li>
                <Link href="/sign-in" className={linkClass}>
                  Sign in
                </Link>
              </li>
            </Show>
            <Show when="signed-in">
              <li>
                <Link href="/app" className={linkClass}>
                  Back to chat
                </Link>
              </li>
            </Show>
            <li>
              <Link href="/profile" className={linkClass}>
                Your plan
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="mx-auto w-full max-w-6xl border-t border-[var(--color-border)] px-4 py-6 text-xs text-[var(--color-fg-muted)] sm:px-6">
        <p>© {new Date().getFullYear()} RAG Notebook. All rights reserved.</p>
      </div>
    </footer>
  );
}
