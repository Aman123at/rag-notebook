import { createHash } from 'node:crypto';

import { getDocumentProxy, getMeta } from 'unpdf';

import { throwIngestionError } from '@/inngest/errors.js';

import type { ExtractedSegment, ExtractionResult, Extractor, ExtractorSource } from './types.js';

const MAX_PAGES = 2000;
const MIN_TOTAL_CHARS = 32;

export interface PdfExtractorInput extends ExtractorSource {
  bytes: Uint8Array;
}

export class PdfExtractor implements Extractor {
  async extract(source: ExtractorSource): Promise<ExtractionResult> {
    const input = source as PdfExtractorInput;
    if (!(input.bytes instanceof Uint8Array)) {
      throwIngestionError('EXTRACTION_FAILED', 'PDF extractor invoked without loaded bytes.');
    }
    return extractPdfFromBytes(source, input.bytes);
  }
}

export async function extractPdfFromBytes(
  source: ExtractorSource,
  bytes: Uint8Array,
): Promise<ExtractionResult> {
  const doc = await openPdf(bytes);
  const numPages = doc.numPages;
  if (numPages <= 0) {
    throwIngestionError('PARSE_FAILURE', 'PDF reports zero pages.');
  }
  if (numPages > MAX_PAGES) {
    throwIngestionError(
      'CONTENT_TOO_LARGE',
      `PDF has ${numPages} pages; max supported is ${MAX_PAGES}.`,
    );
  }

  const segments: ExtractedSegment[] = [];
  const canonical: string[] = [];
  let totalChars = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum += 1) {
    const pageText = await extractPageText(doc, pageNum);
    totalChars += pageText.length;
    canonical.push(pageText);
    if (pageText.length === 0) continue;
    segments.push({
      text: pageText,
      locator: { kind: 'pdf_page', page: pageNum },
    });
  }

  if (totalChars < MIN_TOTAL_CHARS) {
    throwIngestionError(
      'PDF_NO_TEXT_LAYER',
      `PDF text layer is empty (${totalChars} chars across ${numPages} pages). OCR is not supported yet.`,
    );
  }
  if (segments.length === 0) {
    throwIngestionError('PDF_NO_TEXT_LAYER', 'No page yielded extractable text.');
  }

  const meta = await safeGetMeta(doc);
  return {
    title: meta.title ?? source.title,
    segments,
    metadata: {
      pageCount: numPages,
      pdfTitle: meta.title,
      pdfAuthor: meta.author,
      pdfCreationDate: meta.creationDate,
      pdfProducer: meta.producer,
    },
    contentHash: createHash('sha256').update(canonical.join('\f'), 'utf8').digest('hex'),
  };
}

interface OpenedPdf {
  numPages: number;
  getPage(n: number): Promise<{
    getTextContent(): Promise<{ items: Array<{ str?: string; hasEOL?: boolean }> }>;
    cleanup?: () => void;
  }>;
}

async function openPdf(bytes: Uint8Array): Promise<OpenedPdf> {
  try {
    const proxy = (await getDocumentProxy(bytes)) as unknown as OpenedPdf;
    return proxy;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : '';
    if (name === 'PasswordException' || /password/i.test(msg) || /encrypt/i.test(msg)) {
      throwIngestionError('PDF_ENCRYPTED', 'PDF is password-protected.', { cause: err });
    }
    if (/invalid|corrupt|bad pdf/i.test(msg)) {
      throwIngestionError('PARSE_FAILURE', `PDF is corrupt: ${msg}.`, { cause: err });
    }
    throwIngestionError('EXTRACTION_FAILED', `Cannot open PDF: ${msg}.`, { cause: err });
  }
}

async function extractPageText(doc: OpenedPdf, pageNum: number): Promise<string> {
  const page = await doc.getPage(pageNum);
  try {
    const content = await page.getTextContent();
    const parts: string[] = [];
    for (const item of content.items) {
      if (typeof item.str === 'string') parts.push(item.str);
      if (item.hasEOL === true) parts.push('\n');
    }
    return parts
      .join('')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } finally {
    page.cleanup?.();
  }
}

async function safeGetMeta(doc: OpenedPdf): Promise<{
  title: string | null;
  author: string | null;
  creationDate: string | null;
  producer: string | null;
}> {
  try {
    const result = await getMeta(doc as never);
    const info = result.info;
    return {
      title: valueOrNull(info['Title']),
      author: valueOrNull(info['Author']),
      creationDate: valueOrNull(info['CreationDate']),
      producer: valueOrNull(info['Producer']),
    };
  } catch {
    return { title: null, author: null, creationDate: null, producer: null };
  }
}

function valueOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export const pdfExtractor = new PdfExtractor();
