import { z } from 'zod';








export const NumericPlanLimitsSchema = z.object({
  contactOnly: z.literal(false).optional(),
  maxWorkspaces: z.number().int().positive().nullable(),
  maxSourcesPerWorkspace: z.number().int().positive().nullable(),
  lifetimeTokens: z.number().int().positive().nullable(),
  maxPromptWords: z.number().int().positive().nullable(),
  maxFileBytes: z.number().int().positive(),
  maxPlaylistVideos: z.number().int().positive(),
});

export const CustomPlanLimitsSchema = z.object({
  contactOnly: z.literal(true),
  maxWorkspaces: z.null(),
  maxSourcesPerWorkspace: z.null(),
  lifetimeTokens: z.null(),
  maxPromptWords: z.null(),
  maxFileBytes: z.null(),
  maxPlaylistVideos: z.null(),
});

export const PlanLimitsSchema = z.union([NumericPlanLimitsSchema, CustomPlanLimitsSchema]);
export type PlanLimitsWire = z.infer<typeof PlanLimitsSchema>;
