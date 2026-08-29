"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCurrentUser, ME_QUERY_KEY } from "@/hooks/use-current-user";

/**
 * Post-checkout confirmation state.
 *
 * The payment handler firing does NOT mean the user is Pro (CLAUDE.md §5.2,
 * C5 brief §3). Only `GET /me` reporting `planTier: "PRO"` does. We refetch
 * /me on an increasing backoff until either:
 *   - /me reports PRO — we celebrate and close, or
 *   - the timeout elapses — we show a "processing" state with a support path.
 *
 * We never render an error here: the payment probably succeeded and the
 * webhook just hasn't landed yet.
 */

type Status = "confirming" | "confirmed" | "processing";

const POLL_INTERVALS_MS = [1500, 1500, 2000, 3000, 4000, 5000, 5000, 5000, 5000, 5000] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  paymentId: string | null;
}

export function ConfirmingUpgradeDialog({ open, onClose, paymentId }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        {/* Remount on every open so internal state (status, timer) starts fresh. */}
        {open ? <ConfirmingBody onClose={onClose} paymentId={paymentId} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ConfirmingBody({
  onClose,
  paymentId,
}: {
  onClose: () => void;
  paymentId: string | null;
}) {
  const qc = useQueryClient();
  const me = useCurrentUser();
  const [status, setStatus] = React.useState<Status>(() =>
    me.data?.planTier === "PRO" ? "confirmed" : "confirming",
  );

  React.useEffect(() => {
    if (status !== "confirming") return;

    let cancelled = false;
    let attempt = 0;
    let timer = 0;

    const tick = () => {
      if (cancelled) return;
      void qc
        .invalidateQueries({ queryKey: ME_QUERY_KEY })
        .then(() => qc.refetchQueries({ queryKey: ME_QUERY_KEY }))
        .finally(() => {
          if (cancelled) return;
          const next = qc.getQueryData<{ planTier?: string }>(ME_QUERY_KEY);
          if (next?.planTier === "PRO") {
            setStatus("confirmed");
            return;
          }
          if (attempt >= POLL_INTERVALS_MS.length) {
            setStatus("processing");
            return;
          }
          const delay = POLL_INTERVALS_MS[attempt] ?? 5000;
          attempt += 1;
          timer = window.setTimeout(tick, delay);
        });
    };

    timer = window.setTimeout(tick, POLL_INTERVALS_MS[0]);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [status, qc]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {status === "confirmed" ? "You’re on Pro" : "Confirming your payment"}
        </DialogTitle>
        <DialogDescription>
          {status === "confirmed"
            ? "Your workspace and source limits have been raised. Thanks for upgrading."
            : status === "processing"
              ? "Payment received. It’s taking a little longer than usual to activate — no need to pay again."
              : "Waiting for Razorpay to confirm the payment with our server."}
        </DialogDescription>
      </DialogHeader>

      {status === "confirmed" ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm font-medium text-[var(--color-line-green-text)]"
        >
          <CheckCircle2 className="h-4 w-4 flex-none" aria-hidden />
          Confirmed by our server
        </p>
      ) : (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-well)] px-3 py-2.5 text-sm text-[var(--color-fg-muted)]"
        >
          {/* The arrivals track, not a spinner: this is a wait for something
              that is genuinely on its way, which is exactly what the mark means
              everywhere else in the product. */}
          <span className="arrivals-track" aria-hidden />
          <span>
            {status === "processing"
              ? "We’ll move you to Pro the moment the webhook lands."
              : "This usually takes a few seconds."}
          </span>
        </div>
      )}

      {status === "processing" && paymentId && (
        <p className="text-xs text-[var(--color-fg-muted)]">
          Quote this payment id if you contact support:{" "}
          <span className="tabular font-mono text-[var(--color-fg)]">{paymentId}</span>
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {status === "processing" && (
          <Button asChild variant="secondary" size="sm">
            <a href="mailto:support@ragnotebook.app?subject=Upgrade%20confirmation">
              Contact support
            </a>
          </Button>
        )}
        <Button
          variant={status === "confirmed" ? "primary" : "ghost"}
          size="sm"
          onClick={onClose}
        >
          {status === "confirmed" ? "Done" : "Close"}
        </Button>
      </div>
    </>
  );
}
