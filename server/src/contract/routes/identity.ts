import { z } from 'zod';

import { defineRouteDefinition } from '../common/route.js';
import { PlanTierSchema } from '../domain/enums.js';
import { PlanLimitsSchema } from '../domain/plan.js';






export const TokenBudgetSchema = z.object({
  
  assigned: z.number().int().nullable(),
  usedEmbedding: z.number().int().nonnegative(),
  usedCompletion: z.number().int().nonnegative(),
  
  remaining: z.number().int().nullable(),
});

export const MeUsageSchema = z.object({
  workspaces: z.number().int().nonnegative(),
  







  overCaps: z.boolean(),
});

export const MeSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  planTier: PlanTierSchema,
  isActive: z.boolean(),
  isBlocked: z.boolean(),
  tokens: TokenBudgetSchema,
  limits: PlanLimitsSchema,
  usage: MeUsageSchema,
});
export type Me = z.infer<typeof MeSchema>;


export const UpdateMeBodySchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
});


export const ClerkWebhookBodySchema = z.record(z.string(), z.unknown());

export const identityRoutes = {
  'identity.me': defineRouteDefinition({
    method: 'GET',
    path: '/me',
    auth: 'required',
    params: z.object({}),
    query: z.object({}),
    body: z.object({}),
    response: MeSchema,
    errors: ['UNAUTHENTICATED', 'USER_BLOCKED', 'INTERNAL_ERROR'],
    tags: ['identity'],
    summary: 'Get the authenticated user, plan, quotas, and limits.',
  }),
  'identity.updateMe': defineRouteDefinition({
    method: 'PATCH',
    path: '/me',
    auth: 'required',
    params: z.object({}),
    query: z.object({}),
    body: UpdateMeBodySchema,
    response: MeSchema,
    errors: ['UNAUTHENTICATED', 'VALIDATION_ERROR', 'USER_BLOCKED', 'INTERNAL_ERROR'],
    tags: ['identity'],
    summary: 'Update the authenticated user profile.',
  }),
  'identity.clerkWebhook': defineRouteDefinition({
    method: 'POST',
    path: '/webhooks/clerk',
    auth: 'webhook',
    params: z.object({}),
    query: z.object({}),
    body: ClerkWebhookBodySchema,
    response: z.object({ received: z.literal(true) }),
    errors: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'INTERNAL_ERROR'],
    tags: ['identity', 'webhooks'],
    summary: 'Clerk lifecycle webhook (user.created, user.updated, user.deleted).',
  }),
} as const;
