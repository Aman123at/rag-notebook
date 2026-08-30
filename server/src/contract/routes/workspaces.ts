import { z } from 'zod';

import { PaginationQuerySchema } from '../common/pagination.js';
import { defineRouteDefinition } from '../common/route.js';

export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  sourceCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const CreateWorkspaceBodySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
});

export const UpdateWorkspaceBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
});

export const WorkspaceParamsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const workspacesRoutes = {
  'workspaces.list': defineRouteDefinition({
    method: 'GET',
    path: '/workspaces',
    auth: 'required',
    params: z.object({}),
    query: PaginationQuerySchema,
    body: z.object({}),
    response: z.array(WorkspaceSchema),
    errors: ['UNAUTHENTICATED', 'VALIDATION_ERROR', 'INTERNAL_ERROR'],
    tags: ['workspaces'],
    summary: 'List the caller’s workspaces (excluding soft-deleted).',
  }),
  'workspaces.create': defineRouteDefinition({
    method: 'POST',
    path: '/workspaces',
    auth: 'required',
    params: z.object({}),
    query: z.object({}),
    body: CreateWorkspaceBodySchema,
    response: WorkspaceSchema,
    errors: [
      'UNAUTHENTICATED',
      'VALIDATION_ERROR',
      'PLAN_LIMIT_EXCEEDED',
      'CONFLICT',
      'INTERNAL_ERROR',
    ],
    tags: ['workspaces'],
    summary: 'Create a workspace. Enforces the per-plan workspace cap.',
  }),
  'workspaces.get': defineRouteDefinition({
    method: 'GET',
    path: '/workspaces/:workspaceId',
    auth: 'required',
    params: WorkspaceParamsSchema,
    query: z.object({}),
    body: z.object({}),
    response: WorkspaceSchema,
    errors: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL_ERROR'],
    tags: ['workspaces'],
    summary: 'Get one workspace.',
  }),
  'workspaces.update': defineRouteDefinition({
    method: 'PATCH',
    path: '/workspaces/:workspaceId',
    auth: 'required',
    params: WorkspaceParamsSchema,
    query: z.object({}),
    body: UpdateWorkspaceBodySchema,
    response: WorkspaceSchema,
    errors: [
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'CONFLICT',
      'INTERNAL_ERROR',
    ],
    tags: ['workspaces'],
    summary: 'Rename or re-describe a workspace.',
  }),
  'workspaces.delete': defineRouteDefinition({
    method: 'DELETE',
    path: '/workspaces/:workspaceId',
    auth: 'required',
    params: WorkspaceParamsSchema,
    query: z.object({}),
    body: z.object({}),
    response: z.object({ id: z.string().uuid(), deleted: z.literal(true) }),
    errors: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL_ERROR'],
    tags: ['workspaces'],
    summary: 'Soft-delete a workspace and schedule Qdrant cleanup.',
  }),
} as const;
