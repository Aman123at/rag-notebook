import { z } from 'zod';

export const WebSearchOfferMetaSchema = z.object({
  query: z.string().min(1),
});

export const WebSearchUsageMetaSchema = z.object({
  used: z.literal(true),
  query: z.string(),
  resultCount: z.number().int().nonnegative(),
});

export const TurnMetadataSchema = z.object({
  webSearchOffer: WebSearchOfferMetaSchema.optional(),
  webSearch: WebSearchUsageMetaSchema.optional(),
});
export type TurnMetadata = z.infer<typeof TurnMetadataSchema>;
export type WebSearchUsage = z.infer<typeof WebSearchUsageMetaSchema>;
export type WebSearchOffer = z.infer<typeof WebSearchOfferMetaSchema>;

export function readTurnMetadata(raw: unknown): TurnMetadata {
  const parsed = TurnMetadataSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

const AFFIRMATIVE =
  /^(y|ya|yah|yeah|yep|yes|yup|sure|ok|okay|okey|k|do it|go|go on|go ahead|please do|please|search|search it|search web|search the web|do search|yes please|ok please|haan|haa|ha|theek hai|thik hai|kar do|karo)\b/i;

const NEGATIVE = /^(n|no|nope|nah|don'?t|do not|never|skip|cancel|stop|nahi|nahin)\b/i;

/**
 * Decide whether a user message accepts a pending web-search offer.
 *
 * Only meaningful when the previous assistant message actually carried an
 * offer — the caller checks that first.
 *
 * @param content - the raw user message.
 * @returns true when the message reads as an unqualified yes.
 */
export function isAffirmative(content: string): boolean {
  const trimmed = content.trim().replace(/^[\s"'“”‘’]+/, '');
  if (trimmed.length === 0) return false;

  if (trimmed.length > 40) return false;
  if (NEGATIVE.test(trimmed)) return false;
  return AFFIRMATIVE.test(trimmed);
}

const NO_COVERAGE = [
  /\b(?:your |the )?(?:sources?|documents?|files?|material|notebook)\b[^.?!]{0,40}\bdo(?:es)?(?:n'|’)?t\s+(?:cover|mention|contain|include|say|have|provide|discuss)/i,
  /\bdo(?:es)?\s+not\s+(?:cover|mention|contain|include|say|discuss)/i,
  /\b(?:that|this|it)\s+(?:is|'|’)?s?n(?:'|’)?t\s+in\s+the\s+(?:documents?|sources?|files?)/i,
  /\b(?:i\s+)?(?:can(?:'|’)?t|cannot|couldn(?:'|’)?t|could\s+not|am\s+unable\s+to|was\s+unable\s+to)\s+find\s+(?:anything|any\s+(?:information|mention|reference|details?)|it)/i,
  /\bthere(?:'|’)?s?\s+(?:is\s+)?no\s+(?:information|mention|reference)\b[^.?!]{0,40}\b(?:sources?|documents?|material)/i,
  /\bnot\s+(?:covered|mentioned|included)\b[^.?!]{0,40}\b(?:sources?|documents?|material)/i,
];

export function readsAsNoCoverage(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length === 0) return false;

  if (trimmed.length > 600) return false;
  return NO_COVERAGE.some((re) => re.test(trimmed));
}
