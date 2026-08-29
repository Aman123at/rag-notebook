"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useApi } from "@/providers/api";
import { ApiError } from "@/lib/api/errors";
import type { CheckoutOrder } from "@/types/billing.types";

export type { CheckoutOrder } from "@/types/billing.types";

interface CheckoutInput {
  planTier: "PRO";
  couponCode?: string;
}

/**
 * Creates a Razorpay order server-side and returns `{ keyId, orderId }`.
 * The client never receives — and never sends — the amount; it lives on
 * the server-created order (CLAUDE.md §5.1, brief §2).
 */
export function useCheckout(): UseMutationResult<CheckoutOrder, ApiError, CheckoutInput> {
  const api = useApi();
  return useMutation({
    mutationFn: (input) =>
      api.POST("/billing/checkout", {
        body: input.couponCode
          ? { planTier: input.planTier, couponCode: input.couponCode }
          : { planTier: input.planTier },
      }),
  });
}
