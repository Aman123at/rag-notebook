import { z } from 'zod';

import { defineRouteDefinition } from '../common/route.js';






export const UsageDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  embeddingTokens: z.number().int().nonnegative(),
  messageCount: z.number().int().nonnegative(),
});
export const MeUsageResponseSchema = z.object({
  days: z.array(UsageDaySchema),
  totals: z.object({
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    embeddingTokens: z.number().int().nonnegative(),
    messageCount: z.number().int().nonnegative(),
  }),
});

export const HealthzResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
});

export const ReadyzCheckSchema = z.object({
  ok: z.boolean(),
  latencyMs: z.number().nonnegative().nullable(),
  message: z.string().nullable(),
});
export const ReadyzResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  checks: z.object({
    db: ReadyzCheckSchema.nullable(),
    qdrant: ReadyzCheckSchema.nullable(),
  }),
});

export const ContractMetaResponseSchema = z.object({
  version: z.string(),
  gitSha: z.string(),
  generatedAt: z.string().datetime(),
});

export const opsRoutes = {
  'ops.usage': defineRouteDefinition({
    method: 'GET',
    path: '/me/usage',
    auth: 'required',
    params: z.object({}),
    query: z.object({
      days: z.coerce.number().int().min(1).max(90).optional(),
    }),
    body: z.object({}),
    response: MeUsageResponseSchema,
    errors: ['UNAUTHENTICATED', 'VALIDATION_ERROR', 'INTERNAL_ERROR'],
    tags: ['ops'],
    summary: 'Per-day usage breakdown for the caller.',
  }),
  'ops.healthz': defineRouteDefinition({
    method: 'GET',
    path: '/healthz',
    auth: 'public',
    params: z.object({}),
    query: z.object({}),
    body: z.object({}),
    response: HealthzResponseSchema,
    errors: ['INTERNAL_ERROR'],
    tags: ['ops'],
    summary: 'Liveness probe — no dependencies checked.',
  }),
  'ops.readyz': defineRouteDefinition({
    method: 'GET',
    path: '/readyz',
    auth: 'public',
    params: z.object({}),
    query: z.object({}),
    body: z.object({}),
    response: ReadyzResponseSchema,
    errors: ['INTERNAL_ERROR'],
    tags: ['ops'],
    summary: 'Readiness probe — checks database and Qdrant.',
  }),
  'ops.contract': defineRouteDefinition({
    method: 'GET',
    path: '/_contract',
    auth: 'public',
    params: z.object({}),
    query: z.object({}),
    body: z.object({}),
    response: ContractMetaResponseSchema,
    errors: ['INTERNAL_ERROR'],
    tags: ['ops'],
    summary: 'What contract version this server speaks.',
  }),
} as const;
