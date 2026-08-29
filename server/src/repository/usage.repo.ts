import { and, desc, eq, gte, sql } from 'drizzle-orm';

import { exec, type Executor } from '@/db/client.js';
import { usageDaily, type UsageDailyRow } from '@/db/schema/index.js';

export async function bumpUsageDaily(
  userId: string,
  dateIso: string,
  delta: { embedding?: bigint; completion?: bigint; requests?: number },
  tx?: Executor,
): Promise<void> {
  const emb = delta.embedding ?? 0n;
  const comp = delta.completion ?? 0n;
  const reqs = delta.requests ?? 0;
  await exec(tx)
    .insert(usageDaily)
    .values({
      userId,
      date: dateIso,
      embeddingTokens: emb,
      completionTokens: comp,
      requestCount: reqs,
    })
    .onConflictDoUpdate({
      target: [usageDaily.userId, usageDaily.date],
      set: {
        embeddingTokens: sql`${usageDaily.embeddingTokens} + ${emb}`,
        completionTokens: sql`${usageDaily.completionTokens} + ${comp}`,
        requestCount: sql`${usageDaily.requestCount} + ${reqs}`,
      },
    });
}

export async function listUsageForUser(
  userId: string,
  sinceIso: string,
  tx?: Executor,
): Promise<UsageDailyRow[]> {
  return exec(tx)
    .select()
    .from(usageDaily)
    .where(and(eq(usageDaily.userId, userId), gte(usageDaily.date, sinceIso)))
    .orderBy(desc(usageDaily.date));
}
