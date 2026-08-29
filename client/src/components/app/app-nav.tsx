"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/profile", label: "Profile" },
] as const;

/**
 * Concourse nav: tracked caps with an active indicator drawn as a line under
 * the label, the way a station board marks the section you are in. The
 * indicator is a rule in the accent ink, and the active item also carries
 * `aria-current` — the marking is never colour alone.
 */
export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="flex items-stretch gap-1">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center px-3 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]",
              "transition-colors",
              active
                ? "text-[var(--color-fg)]"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
            )}
          >
            {link.label}
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-2 bottom-0 h-[3px] rounded-full transition-opacity",
                active ? "bg-[var(--color-line-cobalt)] opacity-100" : "opacity-0",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
