"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { StreamError } from "@/hooks/use-send-message";
import { useCurrentUser } from "@/hooks/use-current-user";

interface Props {
  error: StreamError;
  onRetry?: (() => void) | undefined;
}

/**
 * Inline chat error. Errors during a turn are rendered as part of the
 * conversation — never as a toast — so the user sees them in context and can
 * act on them (retry, upgrade, contact support). See CLIENT-PLAN §4.2 and §5.
 */
export function InlineError({ error, onRetry }: Props) {
  const me = useCurrentUser();

  if (error.code === "TOKEN_QUOTA_EXCEEDED") {
    const remaining = me.data?.tokens.remaining ?? 0;
    return (
      <ErrorFrame tone="warning">
        <p className="font-medium">You&rsquo;re out of tokens.</p>
        <p className="text-[var(--color-fg-muted)]">
          {remaining.toLocaleString()} tokens remaining. Upgrade to Pro for unlimited
          chats against your sources.
        </p>
        <div className="pt-1">
          <Button asChild size="sm" variant="primary">
            <Link href="/pricing">Upgrade to Pro</Link>
          </Button>
        </div>
      </ErrorFrame>
    );
  }

  if (error.code === "SECURITY_VIOLATION" && error.strike === 1) {
    return (
      <ErrorFrame tone="warning">
        <p className="font-medium">This message was blocked.</p>
        <p className="text-[var(--color-fg-muted)]">
          {error.message} This is a warning. A second violation will block your account.
        </p>
      </ErrorFrame>
    );
  }

  if (
    error.code === "USER_BLOCKED" ||
    (error.code === "SECURITY_VIOLATION" && error.strike === 2)
  ) {
    return (
      <ErrorFrame tone="danger">
        <p className="font-medium">Your account is blocked.</p>
        <p className="text-[var(--color-fg-muted)]">
          Contact support to review this account. Reference request ID below.
        </p>
        {error.requestId ? <RequestId id={error.requestId} /> : null}
      </ErrorFrame>
    );
  }

  if (error.code === "UPSTREAM_ERROR") {
    return (
      <ErrorFrame tone="warning">
        <p className="font-medium">The model provider is unavailable.</p>
        <p className="text-[var(--color-fg-muted)]">Nothing was spent. Try again.</p>
        {onRetry ? (
          <div className="pt-1">
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : null}
      </ErrorFrame>
    );
  }

  if (error.code === "PROMPT_TOO_LONG") {
    return (
      <ErrorFrame tone="warning">
        <p className="font-medium">Your prompt is too long.</p>
        <p className="text-[var(--color-fg-muted)]">{error.message}</p>
      </ErrorFrame>
    );
  }

  if (error.code === "RATE_LIMITED") {
    return (
      <ErrorFrame tone="warning">
        <p className="font-medium">Too many requests.</p>
        <p className="text-[var(--color-fg-muted)]">{error.message}</p>
      </ErrorFrame>
    );
  }

  return (
    <ErrorFrame tone="danger">
      <p className="font-medium">Something went wrong.</p>
      <p className="text-[var(--color-fg-muted)]">{error.message}</p>
      {error.requestId ? <RequestId id={error.requestId} /> : null}
      {onRetry ? (
        <div className="pt-1">
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
    </ErrorFrame>
  );
}

/**
 * A disruption on the line: the severity's ink drawn as a spine down the side.
 *
 * Deliberately no status chip. Each of these errors already opens with a
 * sentence that says exactly what happened, and a generic "Held" / "Blocked"
 * badge above it would be a second, vaguer label competing with the accurate
 * one — the colour is the only thing the frame needs to add.
 */
function ErrorFrame({
  tone,
  children,
}: {
  tone: "warning" | "danger";
  children: React.ReactNode;
}) {
  const ink = tone === "danger" ? "var(--color-line-scarlet-text)" : "var(--color-line-amber-text)";
  return (
    <div
      role="alert"
      className="chassis space-y-2 p-4 text-sm"
      style={{ borderLeft: `var(--spine-width) solid ${ink}` }}
    >
      {children}
    </div>
  );
}

function RequestId({ id }: { id: string }) {
  return (
    <p className="tabular pt-1 font-mono text-[10px] tracking-[0.08em] text-[var(--color-fg-muted)]">
      Request ID &middot; {id}
    </p>
  );
}
