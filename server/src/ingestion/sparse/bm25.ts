import { BM25 } from '@/contract/index.js';

export function bm25Tf(rawCount: number, docLength: number): number {
  const k1 = BM25.k1;
  const b = BM25.b;
  const avgdl = BM25.fixedAvgDocLength;
  const lengthNorm = 1 - b + b * (docLength / avgdl);
  const denom = rawCount + k1 * lengthNorm;
  if (denom === 0) return 0;
  return ((k1 + 1) * rawCount) / denom;
}

export function bm25Idf(docFreq: bigint, totalDocs: bigint): number {
  const df = Number(docFreq);
  const N = Number(totalDocs);
  if (N <= 0) return 0;
  return Math.log((N - df + 0.5) / (df + 0.5) + 1);
}
