export type Severity = 'low' | 'medium' | 'high';
export type ScanStage = 'INGESTION' | 'QUERY';

export interface Rule {
  id: string;
  severity: Severity;
  pattern: RegExp;
  description: string;
}

export interface RuleMatch {
  ruleId: string;
  severity: Severity;

  start: number;
  end: number;

  matched: string;

  excerpt: string;
}

export interface ScanOutcome {
  clean: boolean;
  matches: readonly RuleMatch[];
  highestSeverity: Severity | null;

  patternSetVersion: string;
}
