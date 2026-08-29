"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";

/**
 * Rendered wherever creation is blocked because a user dropped to FREE while
 * over the caps (brief §6). Their existing data stays readable; new creation
 * is blocked until they upgrade or reduce below the caps.
 *
 * Sources the flag from `/me` (`usage.overCaps`), never inferred client-side.
 * Renders nothing when the user is not over caps or is on a paid tier.
 *
 * A service notice in the amber register, matching the one the roadmap uses
 * for a partly-covered route: the line still runs, it just isn't taking on
 * anything new.
 */
export function DowngradeNotice({ context }: { context: "workspace" | "source" | "generic" }) {
  const me = useCurrentUser();
  const user = me.data;
  if (!user) return null;
  if (!user.usage.overCaps) return null;
  if (user.planTier !== "FREE") return null;

  return (
    <div
      role="status"
      className="chassis space-y-2 p-4"
      style={{ borderLeft: "var(--spine-width) solid var(--color-line-amber-text)" }}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-line-amber-text)]">
        <AlertTriangle className="h-3.5 w-3.5 flex-none" aria-hidden />
        Creation paused
      </span>

      <p className="text-sm font-medium text-[var(--color-fg)]">{contextTitle(context)}</p>
      <p className="text-sm leading-relaxed text-[var(--color-fg-muted)]">
        You&rsquo;re on the Free plan but still above its caps from an earlier
        upgrade. Everything you&rsquo;ve already created stays readable — adding
        new items resumes when you upgrade, or when you delete enough to fit.
      </p>
      <div className="pt-1">
        <Link
          href="/pricing"
          className="text-sm font-medium text-[var(--color-line-cobalt-text)] underline-offset-4 hover:underline"
        >
          See Pro plans
        </Link>
      </div>
    </div>
  );
}

function contextTitle(context: "workspace" | "source" | "generic"): string {
  switch (context) {
    case "workspace":
      return "You can’t create a new workspace right now.";
    case "source":
      return "You can’t add a new source right now.";
    case "generic":
      return "New items are paused on your account.";
  }
}
