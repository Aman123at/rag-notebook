import { inArray, sql } from 'drizzle-orm';

import { exec, type Executor } from '@/db/client.js';
import { lexicalDf, lexicalStats } from '@/db/schema/index.js';

export async function bumpDocFrequencies(
  deltas: ReadonlyMap<bigint, number>,
  tx?: Executor,
): Promise<void> {
  if (deltas.size === 0) return;
  const rows: { termHash: bigint; docFreq: bigint }[] = [];
  for (const [termHash, delta] of deltas) {
    if (delta === 0) continue;
    rows.push({ termHash, docFreq: BigInt(delta) });
  }
  if (rows.length === 0) return;
  await exec(tx)
    .insert(lexicalDf)
    .values(rows)
    .onConflictDoUpdate({
      target: lexicalDf.termHash,
      set: {
        docFreq: sql`${lexicalDf.docFreq} + excluded.doc_freq`,
        updatedAt: sql`now()`,
      },
    });
}

export async function bumpTotalDocs(delta: number, tx?: Executor): Promise<void> {
  if (delta === 0) return;
  await exec(tx)
    .insert(lexicalStats)
    .values({ id: 1, totalDocs: BigInt(delta) })
    .onConflictDoUpdate({
      target: lexicalStats.id,
      set: {
        totalDocs: sql`${lexicalStats.totalDocs} + excluded.total_docs`,
        updatedAt: sql`now()`,
      },
    });
}

export async function findDocFrequencies(
  termHashes: readonly bigint[],
  tx?: Executor,
): Promise<Map<bigint, bigint>> {
  const out = new Map<bigint, bigint>();
  if (termHashes.length === 0) return out;
  const rows = await exec(tx)
    .select()
    .from(lexicalDf)
    .where(inArray(lexicalDf.termHash, termHashes));
  for (const row of rows) out.set(row.termHash, row.docFreq);
  return out;
}

export async function readTotalDocs(tx?: Executor): Promise<bigint> {
  const rows = await exec(tx).select().from(lexicalStats);
  const first = rows[0];
  return first ? first.totalDocs : 0n;
}
