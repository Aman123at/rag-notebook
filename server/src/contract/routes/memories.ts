import { z } from 'zod';

import { defineRouteDefinition } from '../common/route.js';

export const MemorySchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Memory = z.infer<typeof MemorySchema>;

export const CreateMemoryBodySchema = z.object({
  content: z.string().min(1).max(4000),
});
export const UpdateMemoryBodySchema = z.object({
  content: z.string().min(1).max(4000),
});
export const MemoryParamsSchema = z.object({ memoryId: z.string().uuid() });

export const memoriesRoutes = {
  'memories.list': defineRouteDefinition({
    method: 'GET',
    path: '/memories',
    auth: 'required',
    params: z.object({}),
    query: z.object({}),
    body: z.object({}),
    response: z.array(MemorySchema),
    errors: ['UNAUTHENTICATED', 'INTERNAL_ERROR'],
    tags: ['memories'],
    summary: 'List long-term memories for the caller.',
  }),
  'memories.create': defineRouteDefinition({
    method: 'POST',
    path: '/memories',
    auth: 'required',
    params: z.object({}),
    query: z.object({}),
    body: CreateMemoryBodySchema,
    response: MemorySchema,
    errors: ['UNAUTHENTICATED', 'VALIDATION_ERROR', 'INTERNAL_ERROR'],
    tags: ['memories'],
    summary: 'Create a memory.',
  }),
  'memories.update': defineRouteDefinition({
    method: 'PATCH',
    path: '/memories/:memoryId',
    auth: 'required',
    params: MemoryParamsSchema,
    query: z.object({}),
    body: UpdateMemoryBodySchema,
    response: MemorySchema,
    errors: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION_ERROR', 'INTERNAL_ERROR'],
    tags: ['memories'],
    summary: 'Update a memory.',
  }),
  'memories.delete': defineRouteDefinition({
    method: 'DELETE',
    path: '/memories/:memoryId',
    auth: 'required',
    params: MemoryParamsSchema,
    query: z.object({}),
    body: z.object({}),
    response: z.object({ id: z.string().uuid(), deleted: z.literal(true) }),
    errors: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL_ERROR'],
    tags: ['memories'],
    summary: 'Delete a memory.',
  }),
} as const;
