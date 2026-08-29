import { type ArtifactStatus } from '@/contract/index.js';
import { type ArtifactRow, type SourceRow } from '@/db/schema/index.js';
import { AppError } from '@/errors/AppError.js';
import { inngest } from '@/inngest/client.js';
import {
  findArtifactForUser,
  findLatestArtifactByKind,
  insertArtifact,
  listArtifactsForSource,
} from '@/repository/artifacts.repo.js';
import {
  findSourceById,
  findSourceForUser,
  listChildSourcesForParent,
} from '@/repository/sources.repo.js';
import type { WireArtifact } from '@/types/artifacts.types.js';

export const PLAYLIST_ROADMAP = 'PLAYLIST_ROADMAP';

export interface SkipEnvelope {
  reason: string;
}

function toWire(row: ArtifactRow): WireArtifact {
  const kind = row.type === PLAYLIST_ROADMAP ? PLAYLIST_ROADMAP : PLAYLIST_ROADMAP;
  const status = row.status as ArtifactStatus;
  let content: unknown = null;
  let skipReason: string | null = null;
  if (status === 'READY') {
    content = row.content;
  } else if (status === 'SKIPPED' || status === 'FAILED') {
    const envelope = row.content as SkipEnvelope | null;
    skipReason = envelope?.reason ?? null;
  }
  return {
    id: row.id,
    sourceId: row.sourceId,
    kind,
    status,
    title: row.type === PLAYLIST_ROADMAP ? 'Learning roadmap' : row.type,
    content,
    skipReason,
    tokensConsumed: row.consumedTokens === null ? null : Number(row.consumedTokens),
    modelName: row.modelName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listArtifacts(userId: string, sourceId: string): Promise<WireArtifact[]> {
  const source = await findSourceForUser(userId, sourceId);
  if (!source) {
    throw new AppError('NOT_FOUND', 'Source not found.', { exposeDetails: false });
  }
  const rows = await listArtifactsForSource(userId, sourceId);
  return rows.map(toWire);
}

export async function getArtifact(userId: string, artifactId: string): Promise<WireArtifact> {
  const row = await findArtifactForUser(userId, artifactId);
  if (!row) {
    throw new AppError('NOT_FOUND', 'Artifact not found.', { exposeDetails: false });
  }
  return toWire(row);
}

export async function requestArtifactRegeneration(
  userId: string,
  sourceId: string,
  body: { kind?: 'PLAYLIST_ROADMAP' | undefined },
): Promise<WireArtifact> {
  const kind = body.kind ?? PLAYLIST_ROADMAP;
  const source = await findSourceForUser(userId, sourceId);
  if (!source) {
    throw new AppError('NOT_FOUND', 'Source not found.', { exposeDetails: false });
  }
  if (source.type !== 'YOUTUBE_PLAYLIST') {
    throw new AppError(
      'VALIDATION_ERROR',
      'Playlist roadmap artifacts are only defined for YOUTUBE_PLAYLIST sources.',
    );
  }
  const children = await listChildSourcesForParent(userId, sourceId);
  if (children.length === 0) {
    throw new AppError(
      'SOURCE_NOT_READY',
      'Playlist has no children yet — wait for expansion to complete.',
    );
  }
  const terminal = new Set<SourceRow['status']>(['READY', 'FAILED', 'QUARANTINED']);
  if (!children.every((c) => terminal.has(c.status))) {
    throw new AppError('SOURCE_NOT_READY', 'Not all playlist videos have finished processing.');
  }

  const latest = await findLatestArtifactByKind(sourceId, kind);
  if (latest && latest.status === 'PENDING') {
    throw new AppError(
      'CONFLICT',
      'An artifact regeneration is already in progress for this source.',
    );
  }

  const row = await insertArtifact({
    sourceId,
    userId,
    type: kind,
    status: 'PENDING',
    content: {},
  });
  await inngest.send({
    id: `artifact/generate.requested:${row.id}`,
    name: 'artifact/generate.requested',
    data: {
      artifactId: row.id,
      sourceId,
      userId,
      workspaceId: source.workspaceId,
      kind,
    },
  });
  return toWire(row);
}

export async function maybeGeneratePlaylistRoadmap(parentSourceId: string): Promise<string | null> {
  const parent = await findSourceById(parentSourceId);
  if (!parent) return null;
  if (parent.type !== 'YOUTUBE_PLAYLIST') return null;
  const children = await listChildSourcesForParent(parent.userId, parent.id);
  if (children.length === 0) return null;
  const terminal = new Set<SourceRow['status']>(['READY', 'FAILED', 'QUARANTINED']);
  if (!children.every((c) => terminal.has(c.status))) return null;

  const latest = await findLatestArtifactByKind(parent.id, PLAYLIST_ROADMAP);
  if (latest && (latest.status === 'READY' || latest.status === 'PENDING')) {
    return null;
  }

  const row = await insertArtifact({
    sourceId: parent.id,
    userId: parent.userId,
    type: PLAYLIST_ROADMAP,
    status: 'PENDING',
    content: {},
  });
  await inngest.send({
    id: `artifact/generate.requested:${row.id}`,
    name: 'artifact/generate.requested',
    data: {
      artifactId: row.id,
      sourceId: parent.id,
      userId: parent.userId,
      workspaceId: parent.workspaceId,
      kind: PLAYLIST_ROADMAP,
    },
  });
  return row.id;
}
