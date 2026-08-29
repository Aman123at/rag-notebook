import type { RuleMatch } from '@/security/types.js';

export interface QuarantineFlags {
  matches: readonly RuleMatch[];
  patternSetVersion: string;

  attemptNumber: number;
}

export interface QuarantineInput {
  userId: string;
  sourceId: string;
  flags: QuarantineFlags;
}
