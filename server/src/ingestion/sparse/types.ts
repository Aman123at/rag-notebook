export interface SparseVector {
  indices: number[];
  values: number[];
}

export interface TermFrequency {
  termHash: bigint;

  count: number;
}

export interface SparseEncoder {
  countTerms(text: string): TermFrequency[];

  encodeDocument(text: string): SparseVector;

  encodeQuery(text: string, dfByHash: ReadonlyMap<bigint, bigint>, totalDocs: bigint): SparseVector;
}

export const HASH_SPACE = 1 << 20;
