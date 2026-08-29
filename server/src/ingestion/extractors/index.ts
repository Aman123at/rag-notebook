import type { SourceType } from '@/contract/index.js';
import { throwIngestionError } from '@/inngest/errors.js';

import { loadExtractorInput } from './load.js';
import { pdfExtractor } from './pdf.js';
import { textExtractor } from './text.js';
import type { ExtractionResult, Extractor, ExtractorSource } from './types.js';
import { vttExtractor } from './vtt.js';
import { webExtractor } from './web.js';
import { youtubeExtractor } from './youtube.js';

const REGISTRY: Record<Exclude<SourceType, 'YOUTUBE_PLAYLIST'>, Extractor> = {
  PDF: pdfExtractor,
  TEXT: textExtractor,
  VTT: vttExtractor,
  WEB_URL: webExtractor,
  YOUTUBE_VIDEO: youtubeExtractor,
};

export function getExtractorFor(type: SourceType): Extractor {
  if (type === 'YOUTUBE_PLAYLIST') {
    throwIngestionError(
      'EXTRACTION_FAILED',
      'YOUTUBE_PLAYLIST cannot go through the extractor registry; use the playlist expander.',
    );
  }
  return REGISTRY[type];
}

export async function runExtraction(source: ExtractorSource): Promise<ExtractionResult> {
  const extractor = getExtractorFor(source.type);
  return extractor.extract(await loadExtractorInput(source));
}

export { loadExtractorInput } from './load.js';
export { pdfExtractor } from './pdf.js';
export { expandYouTubePlaylist, aggregatePlaylistProgress } from './playlist.js';
export { textExtractor, extractFromString } from './text.js';
export type { Extractor, ExtractorSource, ExtractionResult, ExtractedSegment } from './types.js';
export { toExtractorSource } from './types.js';
export {
  vttExtractor,
  extractVttFromString,
  parseVtt,
  parseVttTimestamp,
  stripVttMarkup,
} from './vtt.js';
export { webExtractor, splitMarkdownByHeadings } from './web.js';
export { youtubeExtractor } from './youtube.js';
