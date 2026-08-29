"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/providers/toast";
import { useRedeemCoupon } from "@/hooks/use-redeem-coupon";
import { useCurrentUser } from "@/hooks/use-current-user";

const FIELD =
  "w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-well)] px-3 py-2 font-mono text-sm tracking-[0.06em] text-[var(--color-fg)] transition-colors placeholder:tracking-normal placeholder:text-[var(--color-fg-muted)] focus:border-[var(--color-line-cobalt-text)] focus:outline-none disabled:opacity-45";

export function CouponForm() {
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<{ plan: string; expiresAt: string | null } | null>(
    null,
  );
  const redeem = useRedeemCoupon();
  const me = useCurrentUser();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Enter a coupon code.");
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      const result = await redeem.mutateAsync({ code: trimmed });
      setCode("");
      setSuccess({ plan: result.planTier, expiresAt: result.expiresAt });
      await me.refetch();
    } catch (err) {
      if (!toast.isApiError(err)) return;
      setError(err.message);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-2">
      <label htmlFor="coupon-code" className="label-track block">
        Coupon code
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="coupon-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError(null);
            if (success) setSuccess(null);
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? "coupon-error" : undefined}
          disabled={redeem.isPending}
          maxLength={64}
          placeholder="e.g. LAUNCH2026"
          autoCapitalize="characters"
          spellCheck={false}
          className={`${FIELD} sm:max-w-xs`}
          style={error ? { borderColor: "var(--color-line-scarlet-text)" } : undefined}
        />
        <Button
          type="submit"
          variant="secondary"
          size="md"
          disabled={redeem.isPending || code.trim().length === 0}
        >
          {redeem.isPending ? "Redeeming…" : "Redeem"}
        </Button>
      </div>
      {error && (
        <p id="coupon-error" role="alert" className="text-xs text-[var(--color-line-scarlet-text)]">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-xs text-[var(--color-line-green-text)]">
          Applied. You&rsquo;re on {success.plan}
          {success.expiresAt ? ` until ${formatDate(success.expiresAt)}` : ""}.
        </p>
      )}
    </form>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
