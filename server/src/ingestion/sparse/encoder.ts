import { bm25Idf, bm25Tf } from './bm25.js';
import { fnv1aMod, tokenize } from './tokenizer.js';
import { HASH_SPACE, type SparseEncoder, type SparseVector, type TermFrequency } from './types.js';

class Bm25SparseEncoder implements SparseEncoder {
  countTerms(text: string): TermFrequency[] {
    const tokens = tokenize(text);
    if (tokens.length === 0) return [];

    const counts = new Map<bigint, number>();
    for (const token of tokens) {
      const h = fnv1aMod(token, HASH_SPACE);
      counts.set(h, (counts.get(h) ?? 0) + 1);
    }
    const out: TermFrequency[] = [];
    for (const [termHash, count] of counts) {
      out.push({ termHash, count });
    }
    return out;
  }

  encodeDocument(text: string): SparseVector {
    const tokens = tokenize(text);
    if (tokens.length === 0) return { indices: [], values: [] };
    const counts = new Map<bigint, number>();
    for (const token of tokens) {
      const h = fnv1aMod(token, HASH_SPACE);
      counts.set(h, (counts.get(h) ?? 0) + 1);
    }
    const docLength = tokens.length;
    const indices: number[] = [];
    const values: number[] = [];
    for (const [termHash, count] of counts) {
      const tf = bm25Tf(count, docLength);
      if (tf === 0) continue;
      indices.push(Number(termHash));
      values.push(tf);
    }
    return { indices, values };
  }

  encodeQuery(
    text: string,
    dfByHash: ReadonlyMap<bigint, bigint>,
    totalDocs: bigint,
  ): SparseVector {
    const tokens = tokenize(text);
    if (tokens.length === 0) return { indices: [], values: [] };
    const counts = new Map<bigint, number>();
    for (const token of tokens) {
      const h = fnv1aMod(token, HASH_SPACE);
      counts.set(h, (counts.get(h) ?? 0) + 1);
    }
    const docLength = tokens.length;
    const indices: number[] = [];
    const values: number[] = [];
    for (const [termHash, count] of counts) {
      const tf = bm25Tf(count, docLength);
      const df = dfByHash.get(termHash) ?? 0n;
      const idf = bm25Idf(df, totalDocs);
      const weight = tf * idf;
      if (weight === 0) continue;
      indices.push(Number(termHash));
      values.push(weight);
    }
    return { indices, values };
  }
}

export const sparseEncoder: SparseEncoder = new Bm25SparseEncoder();

export type { SparseEncoder, SparseVector } from './types.js';
