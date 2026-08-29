import type { ArtifactStatus } from '@/contract/index.js';

export interface WireArtifact {
  id: string;
  sourceId: string;
  kind: 'PLAYLIST_ROADMAP';
  status: ArtifactStatus;
  title: string;
  content: unknown;
  skipReason: string | null;
  tokensConsumed: number | null;
  modelName: string | null;
  createdAt: string;
  updatedAt: string;
}
