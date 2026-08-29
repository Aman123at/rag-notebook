import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * A "back to the app" affordance for pages that sit outside the chat view
 * (profile, pricing). Renders as a plain inline link so it can sit above a
 * page heading without competing with it.
 *
 * @param className - Extra classes appended to the link.
 * @returns A link back to the signed-in app landing.
 */
export function BackToAppLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/app"
      className={`inline-flex items-center gap-1.5 rounded-sm text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)] ${className}`}
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      Back to chat
    </Link>
  );
}
