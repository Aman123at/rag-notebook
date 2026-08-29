import { and, eq, lt, sql } from 'drizzle-orm';

import { exec, type Executor } from '@/db/client.js';
import { type TokenReservationRow, tokenReservations } from '@/db/schema/index.js';

type NewTokenReservationRow = typeof tokenReservations.$inferInsert;

export async function insertReservation(
  row: NewTokenReservationRow,
  tx?: Executor,
): Promise<TokenReservationRow> {
  const [inserted] = await exec(tx).insert(tokenReservations).values(row).returning();
  if (!inserted) throw new Error('insertReservation: no row returned');
  return inserted;
}

export async function markReservation(
  reservationId: string,
  status: 'COMMITTED' | 'RELEASED' | 'EXPIRED',
  tx?: Executor,
): Promise<void> {
  await exec(tx)
    .update(tokenReservations)
    .set({ status, updatedAt: sql`now()` })
    .where(eq(tokenReservations.id, reservationId));
}

export async function sumActiveReservationsForUser(userId: string, tx?: Executor): Promise<bigint> {
  const rows = await exec(tx)
    .select({
      total: sql<string>`coalesce(sum(${tokenReservations.estimatedTokens}), 0)`,
    })
    .from(tokenReservations)
    .where(and(eq(tokenReservations.userId, userId), eq(tokenReservations.status, 'RESERVED')));
  const first = rows[0];
  return first ? BigInt(first.total) : 0n;
}

export async function findReservationById(
  reservationId: string,
  tx?: Executor,
): Promise<TokenReservationRow | null> {
  const rows = await exec(tx)
    .select()
    .from(tokenReservations)
    .where(eq(tokenReservations.id, reservationId))
    .limit(1);
  return rows[0] ?? null;
}

export async function transitionReservationStatus(
  reservationId: string,
  from: 'RESERVED',
  to: 'COMMITTED' | 'RELEASED' | 'EXPIRED',
  tx?: Executor,
): Promise<TokenReservationRow | null> {
  const [updated] = await exec(tx)
    .update(tokenReservations)
    .set({ status: to, updatedAt: sql`now()` })
    .where(and(eq(tokenReservations.id, reservationId), eq(tokenReservations.status, from)))
    .returning();
  return updated ?? null;
}

export async function sweepExpiredReservations(tx?: Executor): Promise<number> {
  const updated = await exec(tx)
    .update(tokenReservations)
    .set({ status: 'EXPIRED', updatedAt: sql`now()` })
    .where(
      and(eq(tokenReservations.status, 'RESERVED'), lt(tokenReservations.expiresAt, sql`now()`)),
    )
    .returning({ id: tokenReservations.id });
  return updated.length;
}
