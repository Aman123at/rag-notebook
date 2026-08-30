import { z } from 'zod';

import { SourceTypeSchema } from './enums.js';










export const PdfPageLocatorSchema = z.object({
  kind: z.literal('pdf_page'),
  page: z.number().int().positive(),
});

export const TimestampLocatorSchema = z.object({
  kind: z.literal('timestamp'),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  videoId: z.string().optional(),
});

export const TextRangeLocatorSchema = z.object({
  kind: z.literal('text_range'),
  startChar: z.number().int().nonnegative(),
  endChar: z.number().int().nonnegative(),
});

export const WebLocatorSchema = z.object({
  kind: z.literal('web'),
  url: z.string().url(),
  section: z.string().optional(),
});

export const ChunkLocatorSchema = z.discriminatedUnion('kind', [
  PdfPageLocatorSchema,
  TimestampLocatorSchema,
  TextRangeLocatorSchema,
  WebLocatorSchema,
]);
export type ChunkLocator = z.infer<typeof ChunkLocatorSchema>;


export const CitationSchema = z.object({
  
  index: z.number().int().positive(),
  chunkId: z.string().uuid(),
  sourceId: z.string().uuid(),
  sourceTitle: z.string(),
  sourceType: SourceTypeSchema,
  locator: ChunkLocatorSchema,
  
  snippet: z.string().max(300),
  score: z.number(),
  deepLink: z.string().url().optional(),
});
export type Citation = z.infer<typeof CitationSchema>;


export const WebCitationSchema = z.object({
  index: z.number().int().positive(),
  url: z.string().url(),
  title: z.string(),
  snippet: z.string(),
});
export type WebCitation = z.infer<typeof WebCitationSchema>;
