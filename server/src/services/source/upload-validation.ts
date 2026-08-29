import { randomUUID } from 'node:crypto';

import { env } from '@/config/env.js';
import { type SourceRow } from '@/db/schema/index.js';
import { AppError } from '@/errors/AppError.js';
import type { UploadMimeType } from '@/types/sources.types.js';

export const MIME_TO_SOURCE_TYPE = {
  'application/pdf': { type: 'PDF' as const, exts: ['pdf'] },
  'text/plain': { type: 'TEXT' as const, exts: ['txt', 'text'] },
  'text/vtt': { type: 'VTT' as const, exts: ['vtt'] },
} satisfies Record<UploadMimeType, { type: SourceRow['type']; exts: readonly string[] }>;

export function isSupportedMime(mime: string): mime is UploadMimeType {
  return Object.hasOwn(MIME_TO_SOURCE_TYPE, mime);
}

export function assertMimeAndExtensionMatch(fileName: string, mime: string): UploadMimeType {
  if (!isSupportedMime(mime)) {
    throw new AppError('UNSUPPORTED_MEDIA_TYPE', `Unsupported mime type: ${mime}.`, {
      exposeDetails: true,
      details: { mime },
    });
  }
  const dot = fileName.lastIndexOf('.');
  const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
  const allowed = MIME_TO_SOURCE_TYPE[mime].exts;
  if (!allowed.includes(ext)) {
    throw new AppError(
      'UNSUPPORTED_MEDIA_TYPE',
      `File extension ".${ext}" does not match mime type "${mime}".`,
      { exposeDetails: true, details: { mime, ext, allowed } },
    );
  }
  return mime;
}

export function derivePublicId(userId: string, workspaceId: string): string {
  return `${env.CLOUDINARY_UPLOAD_FOLDER}/${userId}/${workspaceId}/${randomUUID()}`;
}

export function assertPublicIdBelongsTo(
  publicId: string,
  userId: string,
  workspaceId: string,
): void {
  const prefix = `${env.CLOUDINARY_UPLOAD_FOLDER}/${userId}/${workspaceId}/`;
  if (!publicId.startsWith(prefix)) {
    throw new AppError('FORBIDDEN', 'publicId is not scoped to this workspace.', {
      exposeDetails: false,
    });
  }
}
