import { and, eq, inArray, isNull } from 'drizzle-orm';

import { type ChunkLocator, RETRIEVAL, type SourceType } from '@/contract/index.js';
import { type Executor, getDb } from '@/db/client.js';
import { chunks, sources } from '@/db/schema/index.js';
import { buildSignedDownloadUrl } from '@/integrations/cloudinary.js';

import type { HybridFused } from './hybrid.js';
import type { RetrievedChunk } from './types.js';

interface HydrationRow {
  chunkId: string;
  sourceId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  locator: ChunkLocator;
  sourceTitle: string;
  sourceType: SourceType;
  storagePublicId: string | null;
  sourceMetadata: Record<string, unknown> | null;
  originalRef: string;
}

export async function fetchHydrationRows(
  userId: string,
  workspaceId: string,
  chunkIds: readonly string[],
  tx?: Executor,
): Promise<Map<string, HydrationRow>> {
  const out = new Map<string, HydrationRow>();
  if (chunkIds.length === 0) return out;

  const rows = await (tx ?? getDb())
    .select({
      chunkId: chunks.id,
      sourceId: chunks.sourceId,
      chunkIndex: chunks.chunkIndex,
      content: chunks.content,
      tokenCount: chunks.tokenCount,
      locator: chunks.locator,
      sourceTitle: sources.title,
      sourceType: sources.type,
      storagePublicId: sources.storagePublicId,
      sourceMetadata: sources.metadata,
      originalRef: sources.originalRef,
    })
    .from(chunks)
    .innerJoin(sources, eq(chunks.sourceId, sources.id))
    .where(
      and(
        eq(chunks.userId, userId),
        eq(chunks.workspaceId, workspaceId),
        inArray(chunks.id, [...chunkIds]),
        isNull(sources.deletedAt),
      ),
    );

  for (const r of rows) {
    out.set(r.chunkId, {
      chunkId: r.chunkId,
      sourceId: r.sourceId,
      chunkIndex: r.chunkIndex,
      content: r.content,
      tokenCount: r.tokenCount,
      locator: r.locator as ChunkLocator,
      sourceTitle: r.sourceTitle,
      sourceType: r.sourceType,
      storagePublicId: r.storagePublicId,
      sourceMetadata: (r.sourceMetadata ?? null) as Record<string, unknown> | null,
      originalRef: r.originalRef,
    });
  }
  return out;
}

export function assembleRetrievedChunks(
  fused: readonly HybridFused[],
  hydrated: ReadonlyMap<string, HydrationRow>,
  limit: number = RETRIEVAL.finalTopK,
): RetrievedChunk[] {
  const perSource = new Map<string, number>();
  const emitted: RetrievedChunk[] = [];
  const localIndex = new Map<string, number>();
  const deferred: HybridFused[] = [];

  const admit = (f: HybridFused, row: HydrationRow): void => {
    emitted.push({
      chunkId: row.chunkId,
      sourceId: row.sourceId,
      sourceTitle: row.sourceTitle,
      sourceType: row.sourceType,
      locator: row.locator,
      content: row.content,
      chunkIndex: row.chunkIndex,
      tokenCount: row.tokenCount,
      rank: emitted.length + 1,
      fusedScore: f.fusedScore,
      deepLink: buildDeepLink(row.locator, {
        storagePublicId: row.storagePublicId,
        sourceMetadata: row.sourceMetadata,
        originalRef: row.originalRef,
      }),
    });
    perSource.set(row.sourceId, (perSource.get(row.sourceId) ?? 0) + 1);
    localIndex.set(row.chunkId, emitted.length - 1);
  };

  for (const f of fused) {
    if (emitted.length >= limit) break;
    const row = hydrated.get(f.chunkId);
    if (!row) continue;

    if (isAdjacentDuplicate(row, emitted, localIndex)) continue;

    const usedForSource = perSource.get(row.sourceId) ?? 0;
    if (usedForSource >= RETRIEVAL.maxPerSource) {
      deferred.push(f);
      continue;
    }
    admit(f, row);
  }

  for (const f of deferred) {
    if (emitted.length >= limit) break;
    const row = hydrated.get(f.chunkId);
    if (!row) continue;
    if (isAdjacentDuplicate(row, emitted, localIndex)) continue;
    admit(f, row);
  }
  return emitted;
}

function isAdjacentDuplicate(
  row: HydrationRow,
  emitted: readonly RetrievedChunk[],
  localIndex: ReadonlyMap<string, number>,
): boolean {
  for (const prev of emitted) {
    if (prev.sourceId !== row.sourceId) continue;
    if (locatorsOverlap(prev.locator, row.locator)) {
      if (localIndex.get(row.chunkId) !== undefined) return true;
      return true;
    }
  }
  return false;
}

function locatorsOverlap(a: ChunkLocator, b: ChunkLocator): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'pdf_page':
      return b.kind === 'pdf_page' && a.page === b.page;
    case 'timestamp':
      return b.kind === 'timestamp' && a.startMs < b.endMs && b.startMs < a.endMs;
    case 'text_range':
      return b.kind === 'text_range' && a.startChar < b.endChar && b.startChar < a.endChar;
    case 'web':
      return b.kind === 'web' && a.url === b.url;
  }
}

export interface DeepLinkSourceHints {
  storagePublicId: string | null;
  sourceMetadata: Record<string, unknown> | null;
  originalRef: string;
}

export function buildDeepLink(locator: ChunkLocator, hints: DeepLinkSourceHints): string | null {
  switch (locator.kind) {
    case 'timestamp':
      return buildTimestampLink(locator, hints);
    case 'pdf_page':
      return buildPdfPageLink(locator.page, hints.storagePublicId);
    case 'web':
      return buildWebLink(locator, hints.originalRef);
    case 'text_range':
      return null;
  }
}

function buildTimestampLink(
  locator: Extract<ChunkLocator, { kind: 'timestamp' }>,
  hints: DeepLinkSourceHints,
): string | null {
  const seconds = Math.floor(locator.startMs / 1000);
  if (locator.videoId) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(locator.videoId)}&t=${seconds}s`;
  }
  const playerUrl = readStringField(hints.sourceMetadata, 'playerUrl');
  if (playerUrl) {
    const sep = playerUrl.includes('#') ? '&' : '#';
    return `${playerUrl}${sep}t=${seconds}`;
  }
  return null;
}

function buildPdfPageLink(page: number, storagePublicId: string | null): string | null {
  if (!storagePublicId) return null;
  const signed = buildSignedDownloadUrl(storagePublicId);

  return `${signed.url}#page=${page}`;
}

function buildWebLink(
  locator: Extract<ChunkLocator, { kind: 'web' }>,
  originalRef: string,
): string {
  const base = locator.url || originalRef;
  if (!locator.section) return base;

  return `${base}#:~:text=${encodeURIComponent(locator.section)}`;
}

function readStringField(obj: Record<string, unknown> | null, key: string): string | null {
  if (!obj) return null;
  const v = obj[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}
