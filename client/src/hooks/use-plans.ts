"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/providers/api";
import type { GetResult } from "@/lib/api/types";

export type { Plan } from "@/types/billing.types";

export const PLANS_QUERY_KEY = ["plans"] as const;

/**
 * Public plan catalogue. Prices, features, and tier limits come from the
 * server so pricing is not duplicated between client and server.
 */
export function usePlans(): UseQueryResult<GetResult<"/plans">> {
  const api = useApi();
  return useQuery({
    queryKey: PLANS_QUERY_KEY,
    queryFn: () => api.GET("/plans"),
    staleTime: 5 * 60_000,
  });
}
