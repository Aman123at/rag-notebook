import { z } from 'zod';

import { type PaginationMeta, PaginationMetaSchema } from './pagination.js';






export const SuccessEnvelopeMetaSchema = PaginationMetaSchema.partial();
export type SuccessEnvelopeMeta = z.infer<typeof SuccessEnvelopeMetaSchema>;





export function successEnvelope<T extends z.ZodType>(data: T) {
  return z.object({
    data,
    meta: SuccessEnvelopeMetaSchema.optional(),
  });
}









export function ok<T>(data: T, meta?: PaginationMeta): { data: T; meta?: PaginationMeta } {
  if (meta === undefined) return { data };
  return { data, meta };
}
