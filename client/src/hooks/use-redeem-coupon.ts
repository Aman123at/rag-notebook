"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useApi } from "@/providers/api";
import { ApiError } from "@/lib/api/errors";
import { ME_QUERY_KEY } from "@/hooks/use-current-user";
import type { RedeemedCoupon } from "@/types/billing.types";

export type { RedeemedCoupon } from "@/types/billing.types";

export function useRedeemCoupon(): UseMutationResult<
  RedeemedCoupon,
  ApiError,
  { code: string }
> {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code }) => api.POST("/coupons/redeem", { body: { code } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });
}
