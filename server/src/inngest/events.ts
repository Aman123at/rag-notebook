import { z } from 'zod';

import type { ErrorCode } from '@/contract/index.js';

import { inngest } from './client.js';

const uuid = z.string().uuid();

export const SourceIngestRequested = z.object({
  sourceId: uuid,
  userId: uuid,
  workspaceId: uuid,
});
export type SourceIngestRequested = z.infer<typeof SourceIngestRequested>;

export const SourceIngestCompleted = z.object({
  sourceId: uuid,
  userId: uuid,
  workspaceId: uuid,
  chunkCount: z.number().int().nonnegative(),
});
export type SourceIngestCompleted = z.infer<typeof SourceIngestCompleted>;

export const SourceIngestFailed = z.object({
  sourceId: uuid,
  userId: uuid,
  workspaceId: uuid,
  failureCode: z.string().min(1),
  failureMessage: z.string().min(1),
  failureRetryable: z.boolean(),
});
export type SourceIngestFailed = z.infer<typeof SourceIngestFailed>;

export const PlaylistExpandRequested = z.object({
  sourceId: uuid,
  playlistId: z.string().min(1),
  userId: uuid,
  workspaceId: uuid,
});
export type PlaylistExpandRequested = z.infer<typeof PlaylistExpandRequested>;

export const SourceCleanupRequested = z.object({
  sourceId: uuid,
  userId: uuid,
  workspaceId: uuid,
});
export type SourceCleanupRequested = z.infer<typeof SourceCleanupRequested>;

export const WorkspaceCleanupRequested = z.object({
  workspaceId: uuid,
  userId: uuid,
});
export type WorkspaceCleanupRequested = z.infer<typeof WorkspaceCleanupRequested>;

export const UserCleanupRequested = z.object({
  userId: uuid,
});
export type UserCleanupRequested = z.infer<typeof UserCleanupRequested>;

export const ChatSummarizeRequested = z.object({
  chatId: uuid,
  userId: uuid,
});
export type ChatSummarizeRequested = z.infer<typeof ChatSummarizeRequested>;

export const ReservationsSweep = z.object({});
export type ReservationsSweep = z.infer<typeof ReservationsSweep>;

export const ArtifactGenerateRequested = z.object({
  artifactId: uuid,
  sourceId: uuid,
  userId: uuid,
  workspaceId: uuid,
  kind: z.enum(['PLAYLIST_ROADMAP']),
});
export type ArtifactGenerateRequested = z.infer<typeof ArtifactGenerateRequested>;

export const EVENT_SCHEMAS = {
  'source/ingest.requested': SourceIngestRequested,
  'source/ingest.completed': SourceIngestCompleted,
  'source/ingest.failed': SourceIngestFailed,
  'playlist/expand.requested': PlaylistExpandRequested,
  'source/cleanup.requested': SourceCleanupRequested,
  'workspace/cleanup.requested': WorkspaceCleanupRequested,
  'user/cleanup.requested': UserCleanupRequested,
  'chat/summarize.requested': ChatSummarizeRequested,
  'maintenance/reservations.sweep': ReservationsSweep,
  'artifact/generate.requested': ArtifactGenerateRequested,
} as const;

export type EventName = keyof typeof EVENT_SCHEMAS;
export type EventData<K extends EventName> = z.infer<(typeof EVENT_SCHEMAS)[K]>;

export async function sendEvent<K extends EventName>(
  name: K,
  data: EventData<K>,
  opts: { idempotencyKey: string },
): Promise<void> {
  const schema = EVENT_SCHEMAS[name];
  const parsed = schema.parse(data);
  await inngest.send({
    id: `${name}:${opts.idempotencyKey}`,
    name,
    data: parsed as Record<string, unknown>,
  });
}

export type _ContractErrorCodeReference = ErrorCode;
