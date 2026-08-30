import { z } from 'zod';

import { defineRouteDefinition } from '../common/route.js';









export const ARTIFACT_KINDS = ['PLAYLIST_ROADMAP'] as const;
export const ArtifactKindSchema = z.enum(ARTIFACT_KINDS);
export type ArtifactKind = z.infer<typeof ArtifactKindSchema>;









export const ARTIFACT_STATUSES = ['PENDING', 'READY', 'SKIPPED', 'FAILED'] as const;
export const ArtifactStatusSchema = z.enum(ARTIFACT_STATUSES);
export type ArtifactStatus = z.infer<typeof ArtifactStatusSchema>;







export const DIFFICULTY_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
export const DifficultySchema = z.enum(DIFFICULTY_LEVELS);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const PlaylistRoadmapModuleSchema = z.object({
  title: z.string().min(1).max(200),
  objective: z.string().min(1).max(500),
  
  videoIds: z.array(z.string().uuid()).min(1),
  estimatedMinutes: z.number().int().nonnegative(),
  prerequisites: z.array(z.string().min(1)).max(20),
  keyConcepts: z.array(z.string().min(1)).max(20),
});
export type PlaylistRoadmapModule = z.infer<typeof PlaylistRoadmapModuleSchema>;

export const PlaylistRoadmapContentSchema = z.object({
  overview: z.string().min(1).max(2000),
  totalMinutes: z.number().int().nonnegative(),
  difficulty: DifficultySchema,
  modules: z.array(PlaylistRoadmapModuleSchema).min(1).max(50),
});
export type PlaylistRoadmapContent = z.infer<typeof PlaylistRoadmapContentSchema>;






export const ArtifactSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  kind: ArtifactKindSchema,
  status: ArtifactStatusSchema,
  title: z.string(),
  content: z.unknown().nullable(),
  skipReason: z.string().nullable(),
  tokensConsumed: z.number().int().nonnegative().nullable(),
  modelName: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Artifact = z.infer<typeof ArtifactSchema>;







export const CreateArtifactBodySchema = z.object({
  kind: ArtifactKindSchema.optional(),
});
export type CreateArtifactBody = z.infer<typeof CreateArtifactBodySchema>;

export const SourceParamsSchema = z.object({ sourceId: z.string().uuid() });
export const ArtifactParamsSchema = z.object({ artifactId: z.string().uuid() });

export const artifactsRoutes = {
  'artifacts.list': defineRouteDefinition({
    method: 'GET',
    path: '/sources/:sourceId/artifacts',
    auth: 'required',
    params: SourceParamsSchema,
    query: z.object({}),
    body: z.object({}),
    response: z.array(ArtifactSchema),
    errors: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL_ERROR'],
    tags: ['artifacts'],
    summary: 'List derived artifacts for a source (newest first).',
  }),
  'artifacts.create': defineRouteDefinition({
    method: 'POST',
    path: '/sources/:sourceId/artifacts',
    auth: 'required',
    params: SourceParamsSchema,
    query: z.object({}),
    body: CreateArtifactBodySchema,
    response: ArtifactSchema,
    errors: [
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'CONFLICT',
      'SOURCE_NOT_READY',
      'TOKEN_QUOTA_EXCEEDED',
      'INTERNAL_ERROR',
    ],
    tags: ['artifacts'],
    summary:
      'Trigger regeneration of an artifact for the source. Creates a new row; the latest is returned by artifacts.list.',
  }),
  'artifacts.get': defineRouteDefinition({
    method: 'GET',
    path: '/artifacts/:artifactId',
    auth: 'required',
    params: ArtifactParamsSchema,
    query: z.object({}),
    body: z.object({}),
    response: ArtifactSchema,
    errors: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL_ERROR'],
    tags: ['artifacts'],
    summary: 'Get one artifact.',
  }),
} as const;
