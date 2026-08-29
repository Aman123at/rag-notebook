"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { WorkspaceRail } from "./workspace-rail";

/**
 * The rail on small screens. It opens in flow — pushing the conversation down
 * rather than covering it — so a 375px viewport never becomes a modal maze.
 * Closes on navigation, since picking a workspace is the reason it was opened.
 */
export function RailDrawer() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const firstRender = React.useRef(true);

  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setOpen(false);
  }, [pathname]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="rail-drawer"
        className="flex items-center gap-2 rounded-[var(--radius-control)] px-2 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
      >
        {open ? (
          <X className="h-4 w-4" aria-hidden />
        ) : (
          <Menu className="h-4 w-4" aria-hidden />
        )}
        Workspaces
      </button>

      {open ? (
        <div
          id="rail-drawer"
          className="absolute inset-x-0 z-40 max-h-[70vh] overflow-y-auto border-b border-[var(--color-border)] bg-[var(--color-surface)]"
        >
          <WorkspaceRail />
        </div>
      ) : null}
    </div>
  );
}
