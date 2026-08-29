import Link from "next/link";
import { PricingTiers } from "@/components/billing/pricing-tiers";
import { SectionMark } from "@/components/marketing/section-mark";

export const metadata = {
  title: "Pricing · RAG Notebook",
  description: "Free, Pro, and Custom plans for RAG Notebook.",
};

export default function PricingPage() {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-14 sm:px-6"
    >
      <header className="space-y-3">
        {/* Was a tracked-caps kicker above the heading — the pattern the system
            reserves for wayfinding. It reads as a station marker now, the same
            as every section on the landing page. */}
        <SectionMark />
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">
          Simple plans. Bring your own sources.
        </h1>
        <p className="max-w-2xl text-[var(--color-fg-muted)]">
          Start free, upgrade when you outgrow it, and talk to us for anything
          bigger. All prices come straight from our billing service — no
          hidden line items.
        </p>
      </header>

      <PricingTiers />

      <footer className="border-t border-[var(--color-border)] pt-6 text-sm text-[var(--color-fg-muted)]">
        <p>
          Already have an account?{" "}
          <Link
            href="/profile"
            className="font-medium text-[var(--color-line-cobalt-text)] underline-offset-4 hover:underline"
          >
            View your plan
          </Link>
          .
        </p>
      </footer>
    </main>
  );
}
