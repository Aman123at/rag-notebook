import { PATTERN_SET_VERSION, RAW_TEXT_RULE_IDS, RULES } from './patterns.js';
import type { RuleMatch, ScanOutcome, ScanStage, Severity } from './types.js';

const ZERO_WIDTH_RE = new RegExp('[\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u206f\\ufeff]', 'g');
const WHITESPACE_RE = /\s+/g;

const HOMOGLYPH_FOLD: Readonly<Record<string, string>> = Object.freeze({
  а: 'a',
  в: 'b',
  с: 'c',
  е: 'e',
  һ: 'h',
  і: 'i',
  ј: 'j',
  к: 'k',
  ӏ: 'l',
  м: 'm',
  н: 'h',
  о: 'o',
  р: 'p',
  ԛ: 'q',
  ѕ: 's',
  т: 't',
  у: 'y',
  х: 'x',

  α: 'a',
  β: 'b',
  ε: 'e',
  ι: 'i',
  κ: 'k',
  ν: 'v',
  ο: 'o',
  ρ: 'p',
  τ: 't',
  υ: 'y',
  χ: 'x',
  γ: 'y',
});

export function normalise(input: string): string {
  const nfkc = input.normalize('NFKC').toLowerCase();
  const stripped = nfkc.replace(ZERO_WIDTH_RE, '');
  const folded = Array.from(stripped, (ch) => HOMOGLYPH_FOLD[ch] ?? ch).join('');
  return folded.replace(WHITESPACE_RE, ' ').trim();
}

export function redactExcerpt(text: string, start: number, end: number): string {
  const MAX = 120;
  const before = text.slice(Math.max(0, start - 40), start);
  const after = text.slice(end, Math.min(text.length, end + 40));
  const combined = `${before}[REDACTED]${after}`;
  if (combined.length <= MAX) return combined.trim();
  const excess = combined.length - MAX;
  const trimBefore = Math.min(before.length, Math.ceil(excess / 2));
  const trimAfter = excess - trimBefore;
  return `${before.slice(trimBefore)}[REDACTED]${after.slice(0, Math.max(0, after.length - trimAfter))}`.trim();
}

const SEVERITY_ORDER: Record<Severity, number> = { low: 0, medium: 1, high: 2 };

function highestOf(matches: readonly RuleMatch[]): Severity | null {
  if (matches.length === 0) return null;
  let best: Severity = 'low';
  for (const m of matches) {
    if (SEVERITY_ORDER[m.severity] > SEVERITY_ORDER[best]) best = m.severity;
  }
  return best;
}

export function decidePolicy(matches: readonly RuleMatch[]): { clean: boolean } {
  let mediumCount = 0;
  for (const m of matches) {
    if (m.severity === 'high') return { clean: false };
    if (m.severity === 'medium') mediumCount += 1;
  }
  return { clean: mediumCount < 3 };
}

export function scanForInjection(text: string, stage: ScanStage): ScanOutcome {
  void stage;
  const raw = text;
  const norm = normalise(text);
  const matches: RuleMatch[] = [];
  for (const rule of RULES) {
    const target = RAW_TEXT_RULE_IDS.has(rule.id) ? raw : norm;
    const re = new RegExp(
      rule.pattern.source,
      rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`,
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(target)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      matches.push({
        ruleId: rule.id,
        severity: rule.severity,
        start,
        end,
        matched: m[0].slice(0, 200),
        excerpt: redactExcerpt(target, start, end),
      });

      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
  }
  const policy = decidePolicy(matches);
  return {
    clean: policy.clean,
    matches,
    highestSeverity: highestOf(matches),
    patternSetVersion: PATTERN_SET_VERSION,
  };
}

export { attackTypeForRule } from './patterns.js';
