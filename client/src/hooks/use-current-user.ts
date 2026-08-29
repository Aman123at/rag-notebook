"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/providers/api";
import type { Me } from "@/types/users.types";

export type { Me } from "@/types/users.types";

export const ME_QUERY_KEY = ["me"] as const;

/**
 * Single source of truth for the current user, plan tier, and quota state.
 * Every screen reads through this hook so the cache stays consistent — no
 * component fetches /me directly. Refetch it explicitly after any operation
 * that spends tokens or changes the plan (see CLAUDE.md §2.5).
 *
 * The query is disabled until Clerk reports a signed-in session. `/me` is an
 * authenticated route, so firing it while signed out only produced a 401 in
 * the console on public pages that mount this hook (e.g. `/pricing`).
 */
export function useCurrentUser(): UseQueryResult<Me> {
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => api.GET("/me"),
    staleTime: 60_000,
    enabled: isLoaded && isSignedIn === true,
  });
}
