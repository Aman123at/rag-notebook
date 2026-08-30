import { z } from 'zod';

import { defineRouteDefinition } from '../common/route.js';
import { SourceDisplayStatusSchema, SourceStatusSchema, SourceTypeSchema } from '../domain/enums.js';






export const SourceSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  type: SourceTypeSchema,
  title: z.string(),
  originalRef: z.string(),
  status: SourceStatusSchema,
  displayStatus: SourceDisplayStatusSchema,
  mediaId: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  chunkCount: z.number().int().nonnegative(),
  parentSourceId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Source = z.infer<typeof SourceSchema>;






export const SourceFailureSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
});






export const SourceWithFailureSchema = SourceSchema.extend({
  failure: SourceFailureSchema.optional(),
});
export type SourceWithFailure = z.infer<typeof SourceWithFailureSchema>;








export const CreateSourceFileInputSchema = z.object({
  type: z.enum(['PDF', 'TEXT', 'VTT']),
  publicId: z.string().min(1),
  fileName: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
});
export const CreateSourceUrlInputSchema = z.object({
  type: z.enum(['WEB_URL', 'YOUTUBE_VIDEO', 'YOUTUBE_PLAYLIST']),
  url: z.string().url(),
});
export const CreateSourceInputSchema = z.union([
  CreateSourceFileInputSchema,
  CreateSourceUrlInputSchema,
]);
export type CreateSourceInput = z.infer<typeof CreateSourceInputSchema>;


export const UploadIntentBodySchema = z.object({
  fileName: z.string().min(1).max(512),
  mimeType: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
});











export const UploadIntentResponseSchema = z.object({
  uploadUrl: z.string().url(),
  publicId: z.string(),
  timestamp: z.number().int().positive(),
  signature: z.string(),
  apiKey: z.string(),
  resourceType: z.enum(['auto', 'image', 'video', 'raw']),
  expiresAt: z.string().datetime(),
});

export const SourceStatusResponseSchema = z.object({
  id: z.string().uuid(),
  status: SourceStatusSchema,
  displayStatus: SourceDisplayStatusSchema,
  
  progress: z.number().min(0).max(1),
});

export const SourceDownloadResponseSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string().datetime(),
});

















export const SourcePreviewPdfSchema = z.object({
  contentType: z.literal('pdf'),
  signedUrl: z.string().url(),
  expiresAt: z.string().datetime(),
  sizeBytes: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  snippet: z.string(),
});
export const SourcePreviewTextSchema = z.object({
  contentType: z.enum(['text', 'vtt']),
  text: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  highlight: z.object({
    startChar: z.number().int().nonnegative(),
    endChar: z.number().int().nonnegative(),
    snippet: z.string(),
  }),
});
export const SourcePreviewResponseSchema = z.discriminatedUnion('contentType', [
  SourcePreviewPdfSchema,
  SourcePreviewTextSchema,
]);
export type SourcePreviewResponse = z.infer<typeof SourcePreviewResponseSchema>;

export const SourcePreviewQuerySchema = z.object({
  chunkId: z.string().uuid(),
});

export const SourceParamsSchema = z.object({
  sourceId: z.string().uuid(),
});
export const WorkspaceIdParamsSchema = z.object({
  workspaceId: z.string().uuid(),
});






export const SourceStreamStatusEventSchema = z.object({
  type: z.literal('source_status'),
  data: z.object({
    sourceId: z.string().uuid(),
    status: SourceStatusSchema,
    displayStatus: SourceDisplayStatusSchema,
    chunkCount: z.number().int().nonnegative(),
  }),
});
export const SourceStreamHeartbeatEventSchema = z.object({
  type: z.literal('heartbeat'),
  data: z.object({ t: z.number().int().nonnegative() }),
});
export const SourceStreamEventSchema = z.discriminatedUnion('type', [
  SourceStreamStatusEventSchema,
  SourceStreamHeartbeatEventSchema,
]);
export type SourceStreamEvent = z.infer<typeof SourceStreamEventSchema>;

export const sourcesRoutes = {
  'sources.uploadIntent': defineRouteDefinition({
    method: 'POST',
    path: '/workspaces/:workspaceId/sources/upload-intent',
    auth: 'required',
    params: WorkspaceIdParamsSchema,
    query: z.object({}),
    body: UploadIntentBodySchema,
    response: UploadIntentResponseSchema,
    errors: [
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'PAYLOAD_TOO_LARGE',
      'UNSUPPORTED_MEDIA_TYPE',
      'PLAN_LIMIT_EXCEEDED',
      'INTERNAL_ERROR',
    ],
    tags: ['sources'],
    summary: 'Return a signed Cloudinary upload envelope. Never returns the API secret.',
  }),
  'sources.create': defineRouteDefinition({
    method: 'POST',
    path: '/workspaces/:workspaceId/sources',
    auth: 'required',
    params: WorkspaceIdParamsSchema,
    query: z.object({}),
    body: CreateSourceInputSchema,
    response: SourceSchema,
    errors: [
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'PLAN_LIMIT_EXCEEDED',
      'CONFLICT',
      'INTERNAL_ERROR',
    ],
    tags: ['sources'],
    summary: 'Register a source (file already uploaded, or URL) and enqueue extraction.',
  }),
  'sources.list': defineRouteDefinition({
    method: 'GET',
    path: '/workspaces/:workspaceId/sources',
    auth: 'required',
    params: WorkspaceIdParamsSchema,
    query: z.object({}),
    body: z.object({}),
    response: z.array(SourceWithFailureSchema),
    errors: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL_ERROR'],
    tags: ['sources'],
    summary:
      'List sources in a workspace. `failure` is present only on FAILED rows (v1.2.0).',
  }),
  'sources.get': defineRouteDefinition({
    method: 'GET',
    path: '/sources/:sourceId',
    auth: 'required',
    params: SourceParamsSchema,
    query: z.object({}),
    body: z.object({}),
    response: SourceWithFailureSchema,
    errors: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL_ERROR'],
    tags: ['sources'],
    summary: 'Fetch one source with the last failure attached when relevant.',
  }),
  'sources.status': defineRouteDefinition({
    method: 'GET',
    path: '/sources/:sourceId/status',
    auth: 'required',
    params: SourceParamsSchema,
    query: z.object({}),
    body: z.object({}),
    response: SourceStatusResponseSchema,
    errors: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL_ERROR'],
    tags: ['sources'],
    summary: 'Snapshot of a source’s pipeline status.',
  }),
  'sources.retry': defineRouteDefinition({
    method: 'POST',
    path: '/sources/:sourceId/retry',
    auth: 'required',
    params: SourceParamsSchema,
    query: z.object({}),
    body: z.object({}),
    response: SourceSchema,
    errors: [
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'SOURCE_NOT_READY',
      'INTERNAL_ERROR',
    ],
    tags: ['sources'],
    summary: 'Retry a FAILED source (only when `failure.retryable`).',
  }),
  'sources.delete': defineRouteDefinition({
    method: 'DELETE',
    path: '/sources/:sourceId',
    auth: 'required',
    params: SourceParamsSchema,
    query: z.object({}),
    body: z.object({}),
    response: z.object({ id: z.string().uuid(), deleted: z.literal(true) }),
    errors: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL_ERROR'],
    tags: ['sources'],
    summary: 'Soft-delete a source and schedule Qdrant/chunk cleanup.',
  }),
  'sources.download': defineRouteDefinition({
    method: 'GET',
    path: '/sources/:sourceId/download',
    auth: 'required',
    params: SourceParamsSchema,
    query: z.object({}),
    body: z.object({}),
    response: SourceDownloadResponseSchema,
    errors: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL_ERROR'],
    tags: ['sources'],
    summary: 'Signed download URL for the original upload (5 minutes).',
  }),
  'sources.preview': defineRouteDefinition({
    method: 'GET',
    path: '/sources/:sourceId/preview',
    auth: 'required',
    params: SourceParamsSchema,
    query: SourcePreviewQuerySchema,
    body: z.object({}),
    response: SourcePreviewResponseSchema,
    errors: [
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'PAYLOAD_TOO_LARGE',
      'UPSTREAM_ERROR',
      'INTERNAL_ERROR',
    ],
    tags: ['sources'],
    summary:
      'Citation preview payload: PDF signed URL + page, or full text with char range for TEXT/VTT.',
  }),
  'sources.statusStream': defineRouteDefinition({
    method: 'GET',
    path: '/workspaces/:workspaceId/sources/events',
    auth: 'required',
    params: WorkspaceIdParamsSchema,
    query: z.object({}),
    body: z.object({}),
    response: SourceStreamEventSchema,
    errors: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL_ERROR'],
    tags: ['sources', 'sse'],
    summary: 'Server-sent stream of source pipeline updates (heartbeat every 20s).',
    responseContentType: 'text/event-stream',
  }),
} as const;
