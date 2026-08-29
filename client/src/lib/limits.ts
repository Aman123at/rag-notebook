/**
 * Typed accessor for `src/contract/limits.json`. Never hardcode a number from
 * that file at a call site — always look it up here so a contract bump that
 * changes a cap is picked up automatically.
 */
import limitsJson from "@/contract/limits.json";

type PlanTier = "FREE" | "PRO" | "CUSTOM";

interface StandardPlanLimits {
  contactOnly?: false;
  maxWorkspaces: number | null;
  maxSourcesPerWorkspace: number | null;
  lifetimeTokens: number | null;
  maxPromptWords: number | null;
  maxFileBytes: number | null;
  maxPlaylistVideos: number | null;
}

interface ContactOnlyPlanLimits {
  contactOnly: true;
  maxWorkspaces: null;
  maxSourcesPerWorkspace: null;
  lifetimeTokens: null;
  maxPromptWords: null;
  maxFileBytes: null;
  maxPlaylistVideos: null;
}

export type PlanLimits = StandardPlanLimits | ContactOnlyPlanLimits;

export function limitsForPlan(plan: PlanTier): PlanLimits {
  return limitsJson.plans[plan] as PlanLimits;
}

export function isContactOnly(l: PlanLimits): l is ContactOnlyPlanLimits {
  return l.contactOnly === true;
}

/**
 * Retrieval tunables the marketing pages quote. Same rule as the plan caps:
 * read them from the contract, never retype the numbers at a call site.
 */
export interface RetrievalTunables {
  denseTopK: number;
  sparseTopK: number;
  rrfK: number;
  finalTopK: number;
  maxPerSource: number;
}

export function retrievalTunables(): RetrievalTunables {
  return limitsJson.tunables.retrieval;
}
