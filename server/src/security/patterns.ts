import type { Rule } from './types.js';

export const PATTERN_SET_VERSION = '2026.08.28';

const INSTRUCTION_OVERRIDE: Rule[] = [
  {
    id: 'instr.ignore_previous',
    severity: 'high',
    pattern:
      /(?:ignore|disregard|forget|override)\s+(?:all\s+|any\s+|the\s+|your\s+|prior\s+|previous\s+|above\s+)+(?:instruction|instructions|rules?|prompt|guidelines?|directives?)/i,
    description: 'Instruction override — asks the model to discard prior instructions.',
  },
  {
    id: 'instr.new_instructions',
    severity: 'medium',
    pattern:
      /\b(?:new|updated|revised|corrected)\s+(?:instructions?|rules?|prompt|directives?)\s*(?::|are|below|follow)/i,
    description: 'Instruction override — announces a replacement instruction block.',
  },
  {
    id: 'instr.above_wrong',
    severity: 'medium',
    pattern:
      /(?:everything|all)\s+(?:above|before|prior)\s+(?:is|was)\s+(?:wrong|incorrect|fake|a\s+test)/i,
    description: 'Instruction override — invalidates the prior context.',
  },
];

const ROLE_REASSIGNMENT: Rule[] = [
  {
    id: 'role.you_are_now',
    severity: 'high',
    pattern: /\byou\s+are\s+now\s+(?:a|an|the)?\s*[a-z0-9 _-]{1,60}\b/i,
    description: 'Role reassignment — declares a new persona for the model.',
  },
  {
    id: 'role.act_as',
    severity: 'medium',
    pattern:
      /\b(?:act|behave|respond|reply|pretend\s+to\s+be)\s+as\s+(?:a|an|the)?\s*[a-z0-9 _-]{1,60}/i,
    description: 'Role reassignment — asks the model to act as another persona.',
  },
  {
    id: 'role.developer_mode',
    severity: 'high',
    pattern: /\b(?:developer|dev|debug|admin|maintenance|god|root|dan|jailbreak)\s+mode\b/i,
    description: 'Jailbreak — invokes a fake privileged mode.',
  },
  {
    id: 'role.opposite_persona',
    severity: 'medium',
    pattern: /\bopposite\s+(?:of\s+)?(?:you|yourself|your\s+persona|chatgpt|claude|gpt)\b/i,
    description: 'Jailbreak — asks the model to invert its persona.',
  },
];

const SYSTEM_PROMPT_EXTRACTION: Rule[] = [
  {
    id: 'extract.repeat_system',
    severity: 'high',
    pattern:
      /\b(?:repeat|show|print|reveal|display|output|dump|leak|expose)\s+(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?|directive|context|preamble|rules)/i,
    description: 'System-prompt extraction — asks the model to echo its instructions.',
  },
  {
    id: 'extract.what_is_your_prompt',
    severity: 'medium',
    pattern:
      /\bwhat\s+(?:is|are|were)\s+(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?|initial\s+message|rules)\b/i,
    description: 'System-prompt extraction — probes for the hidden prompt.',
  },
  {
    id: 'extract.hidden_verbatim',
    severity: 'medium',
    pattern: /\b(?:verbatim|word\s+for\s+word|character\s+for\s+character)\b/i,
    description: 'System-prompt extraction hint — demands a verbatim dump.',
  },
];

const DELIMITER_INJECTION: Rule[] = [
  {
    id: 'delim.system_tag',
    severity: 'high',
    pattern: /<\/?\s*(?:system|assistant|user|instructions?)\s*>/i,
    description: 'Delimiter injection — fake role tag.',
  },
  {
    id: 'delim.inst_tag',
    severity: 'high',
    pattern: /\[\/?\s*inst\s*\]/i,
    description: 'Delimiter injection — Llama-style [INST] boundary.',
  },
  {
    id: 'delim.im_start',
    severity: 'high',
    pattern: /<\|(?:im_start|im_end|im_sep|endoftext|start|end)\|>/i,
    description: 'Delimiter injection — ChatML-style boundary marker.',
  },
  {
    id: 'delim.begin_of_text',
    severity: 'high',
    pattern: /<\|(?:begin|end)_of_text\|>/i,
    description: 'Delimiter injection — Llama-3-style boundary marker.',
  },
];

const EXFILTRATION: Rule[] = [
  {
    id: 'exfil.send_to',
    severity: 'high',

    pattern:
      /\b(?:send|post|upload|forward|leak|transmit|deliver|exfiltrate)\s+(?:me\s+|us\s+)?(?:(?:all\s+|the\s+|this\s+|these\s+|your\s+|our\s+|entire\s+|whole\s+|full\s+|complete\s+)*(?:user'?s?\s+data|above|preceding|prior|following|conversation|chat\s+(?:log|history)|context|history|transcript|messages?|system\s+prompt|instructions?|credentials?|secrets?|api[\s_-]?keys?|passwords?)\b)[^\n]{0,80}?\bto\s+(?:https?:\/\/|www\.|[^\s@]{1,64}@[a-z0-9.-]{1,64}\.[a-z]{2,12}\b|(?:my|our)\s+(?:url|link|address|e-?mail|endpoint|webhook|server|api|bot|site|website|domain|channel)|(?:the|this|that|following|below)\s+(?:following\s+|below\s+|new\s+|external\s+)?(?:url|link|e-?mail\s+address|endpoint|webhook))/i,
    description:
      'Exfiltration — asks the model to send context or credentials to a third-party destination.',
  },
  {
    id: 'exfil.markdown_image_template_param',
    severity: 'high',
    // The F13 case: matching *any* markdown image whose URL carries a
    // query string quarantined ordinary pages. `![alice](https://
    // github.com/alice.png?size=120)` is an avatar, not an exfiltration
    // channel, and quarantine is terminal with no operator override.
    // The real signal is not "there is a query string" — it is "the
    // query string is a data carrier". This rule takes the conclusive
    // half: an UNEXPANDED TEMPLATE placeholder inside the query. No
    // legitimate page ships `?d={{conversation}}` or `?q=${context}` —
    // a placeholder that survived into the markup means the URL is
    // waiting for the model to fill it in. Quantifiers stay bounded and
    // unnested.
    pattern:
      /!\[[^\]]{0,120}\]\(\s*https?:\/\/[^\s)]{1,300}\?[^\s)]{0,400}(?:\{\{|\$\{|%7b|%24|\{[a-z0-9_ .+-]{1,60}\}|<[a-z0-9_ .+-]{1,60}>)/i,
    description:
      'Exfiltration — markdown image whose query string holds an unexpanded template placeholder.',
  },
  {
    id: 'exfil.markdown_image_long_query_value',
    severity: 'medium',
    // The suggestive half of the same attack: a single query-parameter
    // value long enough to be smuggled content rather than a display
    // parameter. Resize/quality params (`?size=120`, `?w=828&q=75`) are
    // a handful of characters; a 64-character value is a payload.
    // MEDIUM, not high — presigned CDN URLs and tracking pixels have
    // long opaque values too, so this needs corroboration (three
    // mediums, or any high) before it quarantines a source.
    pattern: /!\[[^\]]{0,120}\]\(\s*https?:\/\/[^\s)]{1,300}\?[^\s)]{0,200}=[a-z0-9%_+./-]{64,}/i,
    description: 'Exfiltration — markdown image with an unusually long query-parameter value.',
  },
  {
    id: 'exfil.fetch_and_reply',
    severity: 'medium',
    pattern:
      /\b(?:fetch|curl|request|call)\s+(?:this\s+)?(?:url|endpoint|link)\s+and\s+(?:then\s+)?(?:reply|include|paste|send|return)\b/i,
    description: 'Exfiltration — asks the model to fetch a URL and echo results.',
  },
];

const ENCODED_PAYLOAD: Rule[] = [
  {
    id: 'encoded.long_base64',
    severity: 'medium',
    // Bounded {200,} — no nested quantifier, single character class.
    //
    // The F14 case (found while fixing F13): an inlined `data:image/png;
    // base64,…` thumbnail is one long base64 run, so a page with three
    // inline images scored three mediums and quarantined itself for
    // having pictures in it. The rule hunts *smuggled text*, and a real
    // image is not that.
    //
    // The exemption is deliberately the narrowest one that works — a run
    // is skipped only when BOTH halves hold: it is introduced by a
    // `data:image/…;base64,` prefix, AND its first characters decode to a
    // known raster-image magic number. Checking the magic rather than
    // trusting the declared mime matters: the page that prompted this
    // serves JPEG bytes (`/9j/`) under a `image/png` label, and
    // conversely a payload that *claims* to be an image but does not
    // decode as one is more suspicious than an unlabelled blob, not
    // less. SVG is excluded from the allowlist on purpose — it is text,
    // so a base64 SVG can carry an injection and must stay scannable.
    //
    // Structure: the leading `(?<![a-z0-9+/=])` anchors the match to the
    // START of the run. Without it the exemption would be useless — the
    // engine would simply retry one character into the payload, where
    // the `data:` prefix is no longer behind it, and match anyway.
    // Patterns run against normalised (lower-cased) text, hence the
    // lower-case magic prefixes.
    pattern:
      /(?<![a-z0-9+/=])(?!(?<=data:image\/[a-z0-9.+-]{1,20};base64,)(?:ivborw0kggo|\/9j\/|r0lgod|uklgr|aaabaa))[a-z0-9+/=]{200,}/i,
    description: 'Encoded payload — long unbroken base64 run (≥200 chars).',
  },
  {
    id: 'encoded.zero_width_run',
    severity: 'high',
    // Detected against the RAW text before zero-width stripping.
    // scanner.ts runs this rule pre-normalise.
    pattern: new RegExp('[\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u206f\\ufeff]{4,}'),
    description: 'Encoded payload — run of zero-width or bidi override characters.',
  },
  {
    id: 'encoded.rtl_override',
    severity: 'high',
    pattern: new RegExp('[\\u202d\\u202e]'),
    description: 'Encoded payload — Unicode bidi override (RLO/LRO).',
  },
];

/** The full ordered rule set. Order is stable and drives audit ordering. */
export const RULES: readonly Rule[] = Object.freeze([
  ...INSTRUCTION_OVERRIDE,
  ...ROLE_REASSIGNMENT,
  ...SYSTEM_PROMPT_EXTRACTION,
  ...DELIMITER_INJECTION,
  ...EXFILTRATION,
  ...ENCODED_PAYLOAD,
]);

/**
 * Rules that must run against the ORIGINAL (pre-normalised) text —
 * normalisation strips zero-width and bidi controls, which would defeat
 * detectors for those exact characters. The scanner passes each group
 * the right input.
 */
export const RAW_TEXT_RULE_IDS: ReadonlySet<string> = new Set([
  'encoded.zero_width_run',
  'encoded.rtl_override',
]);

/** Map rule id → attack_type enum value for the `attack_attempts` row. */
export function attackTypeForRule(
  id: string,
): 'PROMPT_INJECTION' | 'JAILBREAK' | 'SYSTEM_PROMPT_EXTRACTION' | 'POISONED_DOCUMENT' {
  if (id.startsWith('extract.')) return 'SYSTEM_PROMPT_EXTRACTION';
  if (id.startsWith('role.')) return 'JAILBREAK';
  if (id.startsWith('encoded.') || id.startsWith('delim.') || id.startsWith('exfil.')) {
    return 'POISONED_DOCUMENT';
  }
  return 'PROMPT_INJECTION';
}
