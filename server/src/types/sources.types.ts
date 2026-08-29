import type { SourceRow } from '@/db/schema/index.js';

export interface LoadedSource {
  id: string;
  userId: string;
  workspaceId: string;
  type: SourceRow['type'];
  title: string;
  originalRef: string;
  status: SourceRow['status'];
}

export interface ExtractionResult {
  title: string;
  segmentCount: number;
}

export interface ScanResult {
  clean: boolean;
}

export interface ChunkingResult {
  chunkCount: number;
}

export interface YouTubeVideoRef {
  kind: 'video';
  videoId: string;
}

export interface YouTubePlaylistRef {
  kind: 'playlist';
  playlistId: string;
}

export type UploadMimeType = 'application/pdf' | 'text/plain' | 'text/vtt';

export type YouTubeRef = YouTubeVideoRef | YouTubePlaylistRef;
