"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { toast } from "@/providers/toast";
import { useCheckout } from "@/hooks/use-checkout";
import { useCurrentUser, type Me } from "@/hooks/use-current-user";
import {
  loadRazorpay,
  type RazorpayFailureResponse,
  type RazorpayOptions,
  type RazorpaySuccessResponse,
} from "./razorpay";
import { ConfirmingUpgradeDialog } from "./confirming-upgrade-dialog";

interface Props {
  couponCode?: string;
  className?: string;
}

/**
 * Kicks off the Pro upgrade. Never trusts the client with the amount — the
 * server returns `{ keyId, orderId }` and Razorpay reads the amount from the
 * order. The success handler does NOT mark the user Pro; it opens the
 * confirming dialog which polls /me until the webhook lands.
 */
export function UpgradeButton({ couponCode, className }: Props) {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const me = useCurrentUser();
  const checkout = useCheckout();

  const [confirming, setConfirming] = React.useState(false);
  const [paymentId, setPaymentId] = React.useState<string | null>(null);
  const [launching, setLaunching] = React.useState(false);

  const busy = launching || checkout.isPending;
  const alreadyPro = me.data?.planTier === "PRO";

  async function onClick() {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/sign-in?redirect_url=/pricing");
      return;
    }
    if (alreadyPro) return;

    setLaunching(true);
    try {
      const [order, Razorpay, user] = await Promise.all([
        checkout.mutateAsync(
          couponCode ? { planTier: "PRO", couponCode } : { planTier: "PRO" },
        ),
        loadRazorpay(),
        me.refetch(),
      ]);

      const options: RazorpayOptions = {
        key: order.keyId,
        order_id: order.orderId,
        name: "RAG Notebook",
        description: "Pro plan",
        // Razorpay's checkout is an external iframe and cannot read our CSS
        // variables, so the accent has to be a literal. This is
        // --color-line-cobalt; the old value here was from the pre-redesign
        // palette and no longer matches anything the user just clicked.
        theme: { color: "#1e5bff" },
        handler: (response: RazorpaySuccessResponse) => {
          setPaymentId(response.razorpay_payment_id);
          setConfirming(true);
        },
        modal: {
          ondismiss: () => {
            // User cancelled — not an error (brief §4).
            toast.info("Upgrade cancelled. You can start it again any time.");
          },
        },
      };
      const prefill = buildPrefill(user.data ?? undefined);
      if (prefill) options.prefill = prefill;

      const rzp = new Razorpay(options);

      rzp.on("payment.failed", (response: RazorpayFailureResponse) => {
        toast.error(
          response.error.description || "Payment failed. Please try again.",
          "Payment failed",
        );
      });

      rzp.open();
    } catch (err) {
      if (toast.isApiError(err)) {
        toast.error(err);
      } else {
        toast.error(err instanceof Error ? err.message : "Could not start checkout.");
      }
    } finally {
      setLaunching(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="primary"
        size="md"
        onClick={onClick}
        disabled={busy || alreadyPro || !isLoaded}
        className={className}
      >
        {alreadyPro
          ? "You’re on Pro"
          : busy
            ? "Opening checkout…"
            : couponCode
              ? "Upgrade with coupon"
              : "Upgrade to Pro"}
      </Button>
      <ConfirmingUpgradeDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        paymentId={paymentId}
      />
    </>
  );
}

function buildPrefill(user: Me | undefined): RazorpayOptions["prefill"] {
  if (!user) return undefined;
  const prefill: { email?: string; name?: string } = {};
  if (user.email) prefill.email = user.email;
  if (user.displayName) prefill.name = user.displayName;
  return Object.keys(prefill).length > 0 ? prefill : undefined;
}
