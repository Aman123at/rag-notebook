import { type PlanTier } from '@/contract/index.js';
import { withTransaction } from '@/db/client.js';
import { AppError } from '@/errors/AppError.js';
import { logger } from '@/observability/logger.js';
import {
  findReservationById,
  insertReservation,
  sumActiveReservationsForUser,
  sweepExpiredReservations as sweepRepo,
  transitionReservationStatus,
} from '@/repository/token-reservations.repo.js';
import { bumpUsageDaily } from '@/repository/usage.repo.js';
import { addTokenUsage, findUserById, lockUserRowForBudget } from '@/repository/users.repo.js';
import type { TokenBudget } from '@/types/entitlements.types.js';

export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  const raw = Math.ceil(text.length / 4);
  return Math.ceil(raw * 1.15);
}

export async function getBudget(userId: string): Promise<TokenBudget> {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError('NOT_FOUND', 'User not found.', { exposeDetails: false });
  }
  const usedEmbedding = Number(user.usedTokensEmbedding);
  const usedCompletion = Number(user.usedTokensCompletion);
  if (user.assignedTokens === null) {
    const reservedBig = await withTransaction((tx) => sumActiveReservationsForUser(user.id, tx));
    return {
      assigned: null,
      usedEmbedding,
      usedCompletion,
      reserved: Number(reservedBig),
      remaining: null,
    };
  }
  const assigned = Number(user.assignedTokens);
  const reservedBig = await withTransaction((tx) => sumActiveReservationsForUser(user.id, tx));
  const reserved = Number(reservedBig);
  const remaining = Math.max(0, assigned - usedEmbedding - usedCompletion - reserved);
  return { assigned, usedEmbedding, usedCompletion, reserved, remaining };
}

export async function reserveTokens(
  userId: string,
  input: {
    kind: 'COMPLETION' | 'EMBEDDING';
    estimatedTokens: number;
    ttlSeconds: number;
    chatId?: string | null;
  },
): Promise<{ reservationId: string; plan: PlanTier }> {
  if (input.estimatedTokens < 0) {
    throw new AppError('VALIDATION_ERROR', 'estimatedTokens must be non-negative.');
  }
  const estimatedBig = BigInt(input.estimatedTokens);

  return withTransaction(async (tx) => {
    const user = await lockUserRowForBudget(userId, tx);
    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found.', { exposeDetails: false });
    }

    if (user.assignedTokens !== null) {
      const reserved = await sumActiveReservationsForUser(userId, tx);
      const used = user.usedTokensEmbedding + user.usedTokensCompletion;
      const remaining = user.assignedTokens - used - reserved;
      if (remaining < estimatedBig) {
        throw new AppError('TOKEN_QUOTA_EXCEEDED', 'Not enough tokens remaining on your plan.', {
          details: {
            assigned: Number(user.assignedTokens),
            used: Number(used),
            reserved: Number(reserved),
            estimated: input.estimatedTokens,
            remaining: Number(remaining < 0n ? 0n : remaining),
            plan: user.planTier,
          },
          exposeDetails: true,
        });
      }
    }

    const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000);
    const row = await insertReservation(
      {
        userId,
        chatId: input.chatId ?? null,
        kind: input.kind,
        estimatedTokens: estimatedBig,
        status: 'RESERVED',
        expiresAt,
      },
      tx,
    );
    return { reservationId: row.id, plan: user.planTier };
  });
}

export async function commitReservation(
  reservationId: string,
  actual: number,
): Promise<{ status: 'committed' | 'already_committed' | 'not_reservable' }> {
  if (actual < 0) {
    throw new AppError('VALIDATION_ERROR', 'actual must be non-negative.');
  }
  const actualBig = BigInt(actual);
  const dateIso = todayIso();

  return withTransaction(async (tx) => {
    const reservation = await findReservationById(reservationId, tx);
    if (!reservation) return { status: 'not_reservable' as const };
    if (reservation.status === 'COMMITTED') return { status: 'already_committed' as const };
    if (reservation.status !== 'RESERVED') return { status: 'not_reservable' as const };

    if (actualBig > reservation.estimatedTokens) {
      logger.warn(
        {
          event: 'entitlements.reservation.under_reserved',
          reservationId,
          estimated: reservation.estimatedTokens.toString(),
          actual: actualBig.toString(),
        },
        'Reservation under-reserved',
      );
    }

    const transitioned = await transitionReservationStatus(
      reservationId,
      'RESERVED',
      'COMMITTED',
      tx,
    );
    if (!transitioned) {
      const reread = await findReservationById(reservationId, tx);
      if (reread?.status === 'COMMITTED') return { status: 'already_committed' as const };
      return { status: 'not_reservable' as const };
    }

    const isEmbedding = reservation.kind === 'EMBEDDING';
    await addTokenUsage(
      reservation.userId,
      isEmbedding ? { embedding: actualBig } : { completion: actualBig },
      tx,
    );
    await bumpUsageDaily(
      reservation.userId,
      dateIso,
      isEmbedding ? { embedding: actualBig, requests: 1 } : { completion: actualBig, requests: 1 },
      tx,
    );

    return { status: 'committed' as const };
  });
}

export async function releaseReservation(reservationId: string): Promise<void> {
  await transitionReservationStatus(reservationId, 'RESERVED', 'RELEASED');
}

export async function sweepExpiredReservations(): Promise<number> {
  return sweepRepo();
}

function todayIso(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
