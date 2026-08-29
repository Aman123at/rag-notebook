import { and, desc, eq, gte } from 'drizzle-orm';

import { exec, type Executor } from '@/db/client.js';
import { type AttackAttemptRow, attackAttempts } from '@/db/schema/index.js';

type NewAttackAttemptRow = typeof attackAttempts.$inferInsert;

export async function recordAttackAttempt(
  row: NewAttackAttemptRow,
  tx?: Executor,
): Promise<AttackAttemptRow> {
  const [inserted] = await exec(tx).insert(attackAttempts).values(row).returning();
  if (!inserted) throw new Error('recordAttackAttempt: no row returned');
  return inserted;
}

export async function countRecentAttemptsForUser(
  userId: string,
  since: Date,
  tx?: Executor,
): Promise<number> {
  const rows = await exec(tx)
    .select({ id: attackAttempts.id })
    .from(attackAttempts)
    .where(and(eq(attackAttempts.userId, userId), gte(attackAttempts.attemptedAt, since)))
    .orderBy(desc(attackAttempts.attemptedAt));
  return rows.length;
}
