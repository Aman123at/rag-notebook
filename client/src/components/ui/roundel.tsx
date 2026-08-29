import * as React from "react";

/**
 * The network mark: a ring crossed by a bar — the transit roundel, the oldest
 * and most legible identity in wayfinding. Drawn as geometry, not lettering,
 * so it holds at 20px in the header and at 64px on a marketing surface.
 */
export function Roundel({
  className,
  size = 22,
  title,
}: {
  className?: string;
  size?: number;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="3.2" />
      <rect x="1.5" y="10.1" width="21" height="3.8" rx="0.6" fill="currentColor" />
    </svg>
  );
}
