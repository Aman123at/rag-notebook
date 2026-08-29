import { eq, sql } from 'drizzle-orm';

import { getDb, withTransaction } from '@/db/client.js';
import { sources } from '@/db/schema/index.js';
import { recordAttackAttempt } from '@/repository/attack-attempts.repo.js';
import { attackTypeForRule } from '@/security/patterns.js';
import type { QuarantineInput } from '@/types/security.types.js';

export async function recordIngestionQuarantine(input: QuarantineInput): Promise<void> {
  const { userId, sourceId, flags } = input;
  await withTransaction(async (tx) => {
    for (const match of flags.matches) {
      await recordAttackAttempt(
        {
          userId,
          attackType: attackTypeForRule(match.ruleId),
          stage: 'INGESTION',
          sourceId,
          attemptNumber: flags.attemptNumber,
          detector: 'REGEX',
          matchedRules: [match.ruleId],
          excerpt: match.excerpt,
        },
        tx,
      );
    }
    await tx
      .update(sources)
      .set({
        securityFlags: {
          patternSetVersion: flags.patternSetVersion,
          quarantinedAt: new Date().toISOString(),
          attemptNumber: flags.attemptNumber,
          matches: flags.matches.map((m) => ({
            ruleId: m.ruleId,
            severity: m.severity,
            excerpt: m.excerpt,
          })),
        },
        updatedAt: sql`now()`,
      })
      .where(eq(sources.id, sourceId));
  });
}

export async function nextIngestionAttemptNumber(sourceId: string): Promise<number> {
  const { attackAttempts } = await import('@/db/schema/index.js');
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(attackAttempts)
    .where(eq(attackAttempts.sourceId, sourceId));
  return (rows[0]?.count ?? 0) + 1;
}
