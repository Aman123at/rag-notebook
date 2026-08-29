"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/providers/api";
import type { Usage } from "@/types/users.types";

export type { Usage } from "@/types/users.types";

export function usageQueryKey(days: number): readonly unknown[] {
  return ["me", "usage", days] as const;
}

export function useUsage(days = 14): UseQueryResult<Usage> {
  const api = useApi();
  return useQuery({
    queryKey: usageQueryKey(days),
    queryFn: () => api.GET("/me/usage", { params: { query: { days } } }),
    staleTime: 60_000,
  });
}
