"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { limitsForPlan, type PlanLimits } from "@/lib/limits";

interface PlanLimitsState {
  plan: "FREE" | "PRO" | "CUSTOM" | null;
  limits: PlanLimits | null;
  isLoading: boolean;
}

/**
 * Reads the current user's plan tier (from GET /me) and resolves it against the
 * caps in `limits.json`. Never hardcode a limit — always go through here.
 */
export function usePlanLimits(): PlanLimitsState {
  const me = useCurrentUser();
  if (me.isLoading || !me.data) {
    return { plan: null, limits: null, isLoading: me.isLoading };
  }
  return {
    plan: me.data.planTier,
    limits: limitsForPlan(me.data.planTier),
    isLoading: false,
  };
}
