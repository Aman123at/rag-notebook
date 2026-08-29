import {
  type Source,
  type SourcePreviewResponse,
  type SourceWithFailure,
  toDisplayStatus,
} from '@/contract/index.js';
import { withTransaction } from '@/db/client.js';
import { type SourceRow } from '@/db/schema/index.js';
import { AppError } from '@/errors/AppError.js';
import { sendEvent } from '@/inngest/events.js';
import {
  buildSignedDownloadUrl,
  buildUploadSignature,
  downloadAssetBytes,
  fetchAssetMetadata,
  type UploadEnvelope,
} from '@/integrations/cloudinary.js';
import { findChunkByIdForUser } from '@/repository/chunks.repo.js';
import {
  findSourceById,
  findSourceForUser,
  insertSourceAndBumpCounter,
  listSourcesForWorkspace,
  recomputeParentChunkCount,
  softDeletePlaylistChildren,
  softDeleteSourceForUser,
  updateSourceStatus,
} from '@/repository/sources.repo.js';
import { findWorkspaceForUser } from '@/repository/workspaces.repo.js';
import { assertCanAddSource, assertFileSize } from '@/services/entitlements/index.js';

import {
  assertMimeAndExtensionMatch,
  assertPublicIdBelongsTo,
  derivePublicId,
} from './upload-validation.js';
import { validatePublicHttpUrl } from './url-guard.js';
import { parseYouTubeUrl } from './youtube-url.js';

function toWire(row: SourceRow): Source {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type,
    title: row.title,
    originalRef: row.originalRef,
    status: row.status,
    displayStatus: toDisplayStatus(row.status),
    mediaId: row.mediaId,
    sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),
    chunkCount: row.chunkCount,
    parentSourceId: row.parentSourceId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toWireWithFailure(row: SourceRow): SourceWithFailure {
  const base = toWire(row);
  if (row.failureCode && row.failureMessage) {
    return {
      ...base,
      failure: {
        code: row.failureCode,
        message: row.failureMessage,
        retryable: row.failureRetryable ?? false,
      },
    };
  }
  return base;
}

export async function enqueueSourceIngestion(sourceId: string): Promise<void> {
  const row = await findSourceById(sourceId);
  if (!row) return;
  await sendEvent(
    'source/ingest.requested',
    { sourceId, userId: row.userId, workspaceId: row.workspaceId },
    { idempotencyKey: sourceId },
  );
}

async function assertWorkspaceExistsForUser(userId: string, workspaceId: string): Promise<void> {
  const ws = await findWorkspaceForUser(userId, workspaceId);
  if (!ws) {
    throw new AppError('NOT_FOUND', 'Workspace not found.', { exposeDetails: false });
  }
}

export async function createUploadIntent(
  userId: string,
  workspaceId: string,
  input: { fileName: string; mimeType: string; sizeBytes: number },
): Promise<UploadEnvelope> {
  await assertWorkspaceExistsForUser(userId, workspaceId);
  assertMimeAndExtensionMatch(input.fileName, input.mimeType);
  await assertFileSize(userId, input.sizeBytes);
  await assertCanAddSource(userId, workspaceId, 1);
  const publicId = derivePublicId(userId, workspaceId);
  return buildUploadSignature(publicId);
}

export async function createSource(
  userId: string,
  workspaceId: string,
  input:
    | {
        type: 'PDF' | 'TEXT' | 'VTT';
        publicId: string;
        fileName: string;
        sizeBytes: number;
      }
    | { type: 'WEB_URL' | 'YOUTUBE_VIDEO' | 'YOUTUBE_PLAYLIST'; url: string },
): Promise<Source> {
  await assertWorkspaceExistsForUser(userId, workspaceId);
  await assertCanAddSource(userId, workspaceId, 1);

  let row: SourceRow;
  if ('publicId' in input) {
    assertPublicIdBelongsTo(input.publicId, userId, workspaceId);
    let asset;
    try {
      asset = await fetchAssetMetadata(input.publicId);
    } catch (err) {
      throw new AppError('UPSTREAM_ERROR', 'Cloudinary asset lookup failed.', {
        exposeDetails: false,
        cause: err,
      });
    }
    if (!asset) {
      throw new AppError('NOT_FOUND', 'No uploaded asset found at that publicId.', {
        exposeDetails: true,
        details: { publicId: input.publicId },
      });
    }
    row = await insertSourceAndBumpCounter({
      userId,
      workspaceId,
      type: input.type,
      status: 'UPLOADED',
      title: input.fileName,
      originalRef: input.fileName,
      storagePublicId: input.publicId,
      mediaId: input.publicId,
      mimeType: null,
      sizeBytes: BigInt(input.sizeBytes),
      parentSourceId: null,
    });
  } else if (input.type === 'WEB_URL') {
    const raw = input.url;
    const url = await validatePublicHttpUrl(raw);
    row = await insertSourceAndBumpCounter({
      userId,
      workspaceId,
      type: 'WEB_URL',
      status: 'PENDING',
      title: url.toString(),
      originalRef: url.toString(),
      parentSourceId: null,
    });
  } else {
    const ref = parseYouTubeUrl(input.url, input.type);
    row = await insertSourceAndBumpCounter({
      userId,
      workspaceId,
      type: input.type,
      status: 'PENDING',
      title: input.url,
      originalRef: input.url,
      mediaId: ref.kind === 'video' ? ref.videoId : ref.playlistId,
      parentSourceId: null,
    });
  }

  await enqueueSourceIngestion(row.id);
  return toWire(row);
}

export async function listSources(
  userId: string,
  workspaceId: string,
): Promise<SourceWithFailure[]> {
  await assertWorkspaceExistsForUser(userId, workspaceId);
  const rows = await listSourcesForWorkspace(userId, workspaceId);
  return rows.map(toWireWithFailure);
}

export async function getSource(userId: string, sourceId: string): Promise<SourceWithFailure> {
  const row = await findSourceForUser(userId, sourceId);
  if (!row) {
    throw new AppError('NOT_FOUND', 'Source not found.', { exposeDetails: false });
  }
  return toWireWithFailure(row);
}

export async function getSourceStatus(
  userId: string,
  sourceId: string,
): Promise<{
  id: string;
  status: SourceRow['status'];
  displayStatus: ReturnType<typeof toDisplayStatus>;
  progress: number;
}> {
  const row = await findSourceForUser(userId, sourceId);
  if (!row) {
    throw new AppError('NOT_FOUND', 'Source not found.', { exposeDetails: false });
  }
  return {
    id: row.id,
    status: row.status,
    displayStatus: toDisplayStatus(row.status),
    progress: coarseProgress(row.status),
  };
}

function coarseProgress(status: SourceRow['status']): number {
  switch (status) {
    case 'PENDING':
      return 0;
    case 'UPLOADED':
      return 0.1;
    case 'EXTRACTING':
      return 0.25;
    case 'EXTRACTED':
      return 0.35;
    case 'SCANNING':
      return 0.5;
    case 'CHUNKING':
      return 0.6;
    case 'CHUNKED':
      return 0.7;
    case 'INDEXING':
      return 0.85;
    case 'READY':
      return 1;
    case 'FAILED':
    case 'QUARANTINED':
      return 0;
  }
}

export async function retrySource(userId: string, sourceId: string): Promise<Source> {
  const row = await findSourceForUser(userId, sourceId);
  if (!row) {
    throw new AppError('NOT_FOUND', 'Source not found.', { exposeDetails: false });
  }
  if (row.status !== 'FAILED') {
    throw new AppError('CONFLICT', 'Only failed sources can be retried.', {
      exposeDetails: true,
      details: { status: row.status },
    });
  }
  if (row.failureRetryable !== true) {
    throw new AppError('SOURCE_NOT_READY', 'This failure is not retryable.', {
      exposeDetails: false,
    });
  }
  const updated = await updateSourceStatus(sourceId, {
    status: 'PENDING',
    failureCode: null,
    failureMessage: null,
    failureRetryable: null,
  });
  if (!updated) {
    throw new AppError('NOT_FOUND', 'Source not found.', { exposeDetails: false });
  }
  await enqueueSourceIngestion(sourceId);
  return toWire(updated);
}

export async function deleteSource(
  userId: string,
  sourceId: string,
): Promise<{ id: string; deleted: true }> {
  const { result, cleanupIds, workspaceId } = await withTransaction(async (tx) => {
    const deleted = await softDeleteSourceForUser(userId, sourceId);
    if (!deleted) {
      throw new AppError('NOT_FOUND', 'Source not found.', { exposeDetails: false });
    }

    const childIds =
      deleted.type === 'YOUTUBE_PLAYLIST'
        ? await softDeletePlaylistChildren(userId, deleted.id, tx)
        : [];

    if (deleted.parentSourceId !== null) {
      await recomputeParentChunkCount(deleted.parentSourceId, tx);
    }
    return {
      result: { id: deleted.id, deleted: true as const },
      cleanupIds: [deleted.id, ...childIds],
      workspaceId: deleted.workspaceId,
    };
  });

  for (const id of cleanupIds) {
    await sendEvent(
      'source/cleanup.requested',
      { sourceId: id, userId, workspaceId },
      { idempotencyKey: id },
    );
  }
  return result;
}

export async function createDownloadUrl(
  userId: string,
  sourceId: string,
): Promise<{ url: string; expiresAt: string }> {
  const row = await findSourceForUser(userId, sourceId);
  if (!row || !row.storagePublicId) {
    throw new AppError('NOT_FOUND', 'Source not found.', { exposeDetails: false });
  }
  return buildSignedDownloadUrl(row.storagePublicId, 300);
}

const PREVIEW_TEXT_MAX_BYTES = 2 * 1024 * 1024;

export async function getSourcePreview(
  userId: string,
  sourceId: string,
  chunkIdParam: string,
): Promise<SourcePreviewResponse> {
  const source = await findSourceForUser(userId, sourceId);
  if (!source || !source.storagePublicId) {
    throw new AppError('NOT_FOUND', 'Source not found.', { exposeDetails: false });
  }
  const chunk = await findChunkByIdForUser(userId, sourceId, chunkIdParam);
  if (!chunk) {
    throw new AppError('NOT_FOUND', 'Chunk not found.', { exposeDetails: false });
  }

  const locator = chunk.locator as {
    kind: string;
    page?: number;
    startChar?: number;
    endChar?: number;
  };
  const declaredSize = source.sizeBytes === null ? 0 : Number(source.sizeBytes);

  if (source.type === 'PDF') {
    if (locator.kind !== 'pdf_page' || typeof locator.page !== 'number') {
      throw new AppError('VALIDATION_ERROR', 'Chunk locator does not match a PDF page.', {
        exposeDetails: false,
      });
    }
    const signed = buildSignedDownloadUrl(source.storagePublicId, 300);
    return {
      contentType: 'pdf',
      signedUrl: signed.url,
      expiresAt: signed.expiresAt,
      sizeBytes: declaredSize,
      page: locator.page,
      snippet: chunk.content.slice(0, 300),
    };
  }

  if (source.type === 'TEXT' || source.type === 'VTT') {
    if (
      locator.kind !== 'text_range' ||
      typeof locator.startChar !== 'number' ||
      typeof locator.endChar !== 'number'
    ) {
      throw new AppError('VALIDATION_ERROR', 'Chunk locator does not match a text range.', {
        exposeDetails: false,
      });
    }
    if (declaredSize > PREVIEW_TEXT_MAX_BYTES) {
      throw new AppError(
        'PAYLOAD_TOO_LARGE',
        'Source is too large to preview inline; fall back to snippet.',
        { exposeDetails: false },
      );
    }
    const bytes = await downloadAssetBytes(source.storagePublicId, {
      maxBytes: PREVIEW_TEXT_MAX_BYTES,
    });
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const startChar = Math.min(locator.startChar, text.length);
    const endChar = Math.min(Math.max(locator.endChar, startChar), text.length);
    return {
      contentType: source.type === 'TEXT' ? 'text' : 'vtt',
      text,
      sizeBytes: bytes.byteLength,
      highlight: {
        startChar,
        endChar,
        snippet: chunk.content.slice(0, 300),
      },
    };
  }

  throw new AppError('VALIDATION_ERROR', 'Source type does not support inline preview.', {
    exposeDetails: false,
  });
}
