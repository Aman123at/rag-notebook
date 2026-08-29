import type { ChunkLocator, SourceType } from '@/contract/index.js';
import type { SourceRow } from '@/db/schema/index.js';

export interface ExtractorSource {
  id: string;
  userId: string;
  workspaceId: string;
  type: SourceType;
  title: string;

  originalRef: string;

  storagePublicId?: string | undefined;

  mediaId?: string | undefined | null;
  mimeType?: string | undefined;
  sizeBytes?: bigint | undefined;
}

export interface ExtractedSegment {
  text: string;

  locator: ChunkLocator;

  metadata?: Record<string, unknown>;
}

export interface ExtractionResult {
  title: string;
  segments: ExtractedSegment[];
  metadata: Record<string, unknown>;

  contentHash: string;
}

export interface Extractor {
  extract(source: ExtractorSource): Promise<ExtractionResult>;
}

export function toExtractorSource(row: SourceRow): ExtractorSource {
  return {
    id: row.id,
    userId: row.userId,
    workspaceId: row.workspaceId,
    type: row.type,
    title: row.title,
    originalRef: row.originalRef,
    storagePublicId: row.storagePublicId ?? undefined,
    mediaId: row.mediaId ?? undefined,
    mimeType: row.mimeType ?? undefined,
    sizeBytes: row.sizeBytes ?? undefined,
  };
}
