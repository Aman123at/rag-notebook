import { createHash } from 'node:crypto';

import { scrapeUrlAsMarkdown } from '@/integrations/firecrawl.js';

import type { ExtractedSegment, ExtractionResult, Extractor, ExtractorSource } from './types.js';

const MAX_EXTRACTED_CHARS = 1_000_000;

export interface HeadingBlock {
  section: string | null;
  text: string;
}

export function splitMarkdownByHeadings(markdown: string): HeadingBlock[] {
  const lines = markdown.split('\n');
  const blocks: HeadingBlock[] = [];
  let currentSection: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    const text = buffer.join('\n').trim();
    if (text.length > 0) blocks.push({ section: currentSection, text });
    buffer = [];
  };
  const headingRe = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
  for (const line of lines) {
    const m = headingRe.exec(line);
    if (m?.[2]) {
      flush();
      currentSection = m[2].trim();
      continue;
    }
    buffer.push(line);
  }
  flush();
  return blocks;
}

const BOILERPLATE_RE =
  /^(?:back(?:\s+to\s+\S+){0,3}|home|menu|skip\s+to\s+(?:main\s+)?content|rss(?:\s+feed)?|subscribe|share|previous|next|newer|older|all\s+posts?|archive|tags?|search|sign\s+(?:in|up)|log\s*in|contact|about|privacy(?:\s+policy)?|terms(?:\s+of\s+service)?|©.*|copyright.*)$/i;

const MIN_BLOCK_CHARS = 80;

function visibleText(markdown: string): string {
  return markdown
    .replace(/!?\[([^\]]{0,200})\]\([^)]{0,500}\)/g, '$1')
    .replace(/[#>*_`~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True when a heading-less block is page chrome rather than content.
 *
 * The F7 case: a blog's `[← Back to blog](…)` header and
 * `[RSS feed](…)` footer each became a standalone 40-character chunk
 * with its own embedding, competing in retrieval against real passages.
 * A block is dropped when it is short AND either matches a known
 * navigation phrase or is essentially nothing but links. Blocks under a
 * real heading are never dropped — a short section with a heading is
 * still authored content.
 *
 * @param block - One heading-delimited block from the markdown.
 * @returns `true` when the block should not be indexed.
 */
export function isBoilerplateBlock(block: HeadingBlock): boolean {
  if (block.section !== null) return false;
  const visible = visibleText(block.text);
  if (visible.length === 0) return true;
  if (visible.length >= MIN_BLOCK_CHARS) return false;
  if (BOILERPLATE_RE.test(visible.replace(/^[←→<>\s|•·-]+|[←→<>\s|•·-]+$/g, ''))) return true;
  // Nothing but link labels and a few connectives.
  const linkCount = (block.text.match(/\]\(/g) ?? []).length;
  return linkCount > 0 && visible.length < MIN_BLOCK_CHARS;
}

export class WebExtractor implements Extractor {
  async extract(source: ExtractorSource): Promise<ExtractionResult> {
    const url = source.originalRef;
    const result = await scrapeUrlAsMarkdown(url);
    let markdown = result.markdown;
    let truncated = false;
    if (markdown.length > MAX_EXTRACTED_CHARS) {
      markdown = markdown.slice(0, MAX_EXTRACTED_CHARS);
      truncated = true;
    }
    const allBlocks = splitMarkdownByHeadings(markdown);
    // Drop nav/footer chrome before it earns an embedding (F7).
    const blocks = allBlocks.filter((b) => !isBoilerplateBlock(b));
    const finalUrl = result.finalUrl;
    const segments: ExtractedSegment[] = blocks.map((b) => {
      const locator = b.section
        ? { kind: 'web' as const, url: finalUrl, section: b.section }
        : { kind: 'web' as const, url: finalUrl };
      return { text: b.text, locator };
    });
    if (segments.length === 0) {
      // Fall back to a single unheaded segment so a page with no
      // headings still produces one chunk.
      segments.push({
        text: markdown.trim(),
        locator: { kind: 'web', url: finalUrl },
      });
    }
    return {
      title: result.title ?? source.title,
      segments,
      metadata: {
        finalUrl: result.finalUrl,
        description: result.description,
        language: result.language,
        scrapedAt: result.scrapedAt,
        truncated,
      },
      contentHash: createHash('sha256').update(markdown, 'utf8').digest('hex'),
    };
  }
}

export const webExtractor = new WebExtractor();
