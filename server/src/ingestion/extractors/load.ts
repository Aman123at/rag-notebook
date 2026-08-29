import { throwIngestionError } from '@/inngest/errors.js';
import { downloadAssetBytes } from '@/integrations/cloudinary.js';

import type { PdfExtractorInput } from './pdf.js';
import type { TextExtractorInput } from './text.js';
import type { ExtractorSource } from './types.js';
import type { VttExtractorInput } from './vtt.js';

const FILE_BACKED = new Set(['PDF', 'TEXT', 'VTT']);

export async function loadExtractorInput(source: ExtractorSource): Promise<ExtractorSource> {
  if (!FILE_BACKED.has(source.type)) return source;

  if (!source.storagePublicId) {
    throwIngestionError(
      'EXTRACTION_FAILED',
      `Source ${source.id} is ${source.type} but carries no storagePublicId.`,
    );
  }

  const declared = source.sizeBytes === undefined ? undefined : Number(source.sizeBytes);
  const bytes = await downloadAssetBytes(
    source.storagePublicId,
    declared !== undefined && Number.isFinite(declared) && declared > 0
      ? { maxBytes: declared }
      : {},
  );

  if (source.type === 'PDF') {
    const input: PdfExtractorInput = { ...source, bytes };
    return input;
  }
  const input: TextExtractorInput | VttExtractorInput = {
    ...source,
    content: decodeUtf8(bytes, source.id),
  };
  return input;
}

function decodeUtf8(bytes: Uint8Array, sourceId: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (err) {
    throwIngestionError('UNSUPPORTED_CONTENT', `Source ${sourceId} is not valid UTF-8 text.`, {
      cause: err,
    });
  }
}
