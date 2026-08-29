const STOPWORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'being',
  'but',
  'by',
  'do',
  'does',
  'doing',
  'done',
  'for',
  'from',
  'had',
  'has',
  'have',
  'having',
  'he',
  'her',
  'hers',
  'herself',
  'him',
  'himself',
  'his',
  'i',
  'in',
  'into',
  'is',
  'it',
  'its',
  'itself',
  'me',
  'my',
  'myself',
  'of',
  'on',
  'our',
  'ours',
  'ourselves',
  'she',
  'so',
  'some',
  'such',
  'than',
  'that',
  'the',
  'their',
  'theirs',
  'them',
  'themselves',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'to',
  'too',
  'up',
  'us',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'who',
  'whom',
  'with',
  'you',
  'your',
  'yours',
  'yourself',
  'yourselves',
]);

const WORD_SPLIT_RE = /[^\p{L}\p{N}]+/u;

const MIN_TOKEN_LEN = 2;

function rawTokens(text: string): string[] {
  if (text.length === 0) return [];
  const normalised = text.normalize('NFKC').toLowerCase();
  return normalised.split(WORD_SPLIT_RE).filter((t) => t.length > 0);
}

export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const raw of rawTokens(text)) {
    if (STOPWORDS.has(raw)) continue;
    const stemmed = porterStem(raw);
    if (stemmed.length < MIN_TOKEN_LEN) continue;
    out.push(stemmed);
  }
  return out;
}

export function porterStem(word: string): string {
  if (word.length <= 2) return word;
  let w = word;

  w = step1a(w);
  w = step1b(w);
  w = step1c(w);
  w = step2(w);
  w = step3(w);
  w = step4(w);
  w = step5(w);

  return w;
}

function isConsonant(w: string, i: number): boolean {
  const ch = w[i];
  if (ch === undefined) return false;
  if ('aeiou'.includes(ch)) return false;
  if (ch === 'y') {
    if (i === 0) return true;
    return !isConsonant(w, i - 1);
  }
  return true;
}

function measure(stem: string): number {
  let n = 0;
  let i = 0;
  const len = stem.length;
  while (i < len && isConsonant(stem, i)) i += 1;
  while (i < len) {
    while (i < len && !isConsonant(stem, i)) i += 1;
    if (i >= len) break;
    n += 1;
    while (i < len && isConsonant(stem, i)) i += 1;
  }
  return n;
}

function containsVowel(stem: string): boolean {
  for (let i = 0; i < stem.length; i += 1) {
    if (!isConsonant(stem, i)) return true;
  }
  return false;
}

function endsDoubleConsonant(stem: string): boolean {
  const len = stem.length;
  if (len < 2) return false;
  const a = stem[len - 1];
  const b = stem[len - 2];
  return a === b && isConsonant(stem, len - 1);
}

function endsCvc(stem: string): boolean {
  const len = stem.length;
  if (len < 3) return false;
  if (!isConsonant(stem, len - 1)) return false;
  if (isConsonant(stem, len - 2)) return false;
  if (!isConsonant(stem, len - 3)) return false;
  const last = stem[len - 1];
  if (last === 'w' || last === 'x' || last === 'y') return false;
  return true;
}

function replaceSuffix(w: string, suffix: string, replacement: string): string {
  return w.slice(0, w.length - suffix.length) + replacement;
}

function step1a(w: string): string {
  if (w.endsWith('sses')) return replaceSuffix(w, 'sses', 'ss');
  if (w.endsWith('ies')) return replaceSuffix(w, 'ies', 'i');
  if (w.endsWith('ss')) return w;
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

function step1b(w: string): string {
  if (w.endsWith('eed')) {
    if (measure(w.slice(0, -3)) > 0) return replaceSuffix(w, 'eed', 'ee');
    return w;
  }
  let stem: string | null = null;
  let matched = false;
  if (w.endsWith('ed') && containsVowel(w.slice(0, -2))) {
    stem = w.slice(0, -2);
    matched = true;
  } else if (w.endsWith('ing') && containsVowel(w.slice(0, -3))) {
    stem = w.slice(0, -3);
    matched = true;
  }
  if (!matched || stem === null) return w;
  if (stem.endsWith('at') || stem.endsWith('bl') || stem.endsWith('iz')) {
    return `${stem}e`;
  }
  if (endsDoubleConsonant(stem)) {
    const last = stem[stem.length - 1];
    if (last !== 'l' && last !== 's' && last !== 'z') return stem.slice(0, -1);
    return stem;
  }
  if (measure(stem) === 1 && endsCvc(stem)) return `${stem}e`;
  return stem;
}

function step1c(w: string): string {
  if (w.endsWith('y') && containsVowel(w.slice(0, -1))) {
    return `${w.slice(0, -1)}i`;
  }
  return w;
}

const STEP2_SUFFIXES: ReadonlyArray<readonly [string, string]> = [
  ['ational', 'ate'],
  ['tional', 'tion'],
  ['enci', 'ence'],
  ['anci', 'ance'],
  ['izer', 'ize'],
  ['abli', 'able'],
  ['alli', 'al'],
  ['entli', 'ent'],
  ['eli', 'e'],
  ['ousli', 'ous'],
  ['ization', 'ize'],
  ['ation', 'ate'],
  ['ator', 'ate'],
  ['alism', 'al'],
  ['iveness', 'ive'],
  ['fulness', 'ful'],
  ['ousness', 'ous'],
  ['aliti', 'al'],
  ['iviti', 'ive'],
  ['biliti', 'ble'],
];

function step2(w: string): string {
  for (const [suf, rep] of STEP2_SUFFIXES) {
    if (w.endsWith(suf)) {
      const stem = w.slice(0, w.length - suf.length);
      if (measure(stem) > 0) return `${stem}${rep}`;
      return w;
    }
  }
  return w;
}

const STEP3_SUFFIXES: ReadonlyArray<readonly [string, string]> = [
  ['icate', 'ic'],
  ['ative', ''],
  ['alize', 'al'],
  ['iciti', 'ic'],
  ['ical', 'ic'],
  ['ful', ''],
  ['ness', ''],
];

function step3(w: string): string {
  for (const [suf, rep] of STEP3_SUFFIXES) {
    if (w.endsWith(suf)) {
      const stem = w.slice(0, w.length - suf.length);
      if (measure(stem) > 0) return `${stem}${rep}`;
      return w;
    }
  }
  return w;
}

const STEP4_SUFFIXES: ReadonlyArray<string> = [
  'al',
  'ance',
  'ence',
  'er',
  'ic',
  'able',
  'ible',
  'ant',
  'ement',
  'ment',
  'ent',
  'ou',
  'ism',
  'ate',
  'iti',
  'ous',
  'ive',
  'ize',
];

function step4(w: string): string {
  for (const suf of STEP4_SUFFIXES) {
    if (w.endsWith(suf)) {
      const stem = w.slice(0, w.length - suf.length);
      if (measure(stem) <= 1) return w;
      if (suf === 'ion') {
        const last = stem[stem.length - 1];
        if (last !== 's' && last !== 't') return w;
      }
      return stem;
    }
  }
  if (w.endsWith('ion')) {
    const stem = w.slice(0, -3);
    const last = stem[stem.length - 1];
    if (measure(stem) > 1 && (last === 's' || last === 't')) return stem;
  }
  return w;
}

function step5(w: string): string {
  if (w.endsWith('e')) {
    const stem = w.slice(0, -1);
    const m = measure(stem);
    if (m > 1) return stem;
    if (m === 1 && !endsCvc(stem)) return stem;
  }
  if (measure(w) > 1 && endsDoubleConsonant(w) && w.endsWith('l')) {
    return w.slice(0, -1);
  }
  return w;
}

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const U64_MASK = 0xffffffffffffffffn;

export function fnv1aMod(term: string, mod: number): bigint {
  const bytes = Buffer.from(term, 'utf8');
  let h = FNV_OFFSET_BASIS;
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    if (b === undefined) continue;
    h = (h ^ BigInt(b)) & U64_MASK;
    h = (h * FNV_PRIME) & U64_MASK;
  }
  return h % BigInt(mod);
}
