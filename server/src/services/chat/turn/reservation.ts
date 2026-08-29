import { AppError } from '@/errors/AppError.js';
import { logger } from '@/observability/logger.js';
import {
  commitReservation,
  estimateTokens,
  releaseReservation,
  reserveTokens,
} from '@/services/entitlements/index.js';

export const EXPECTED_COMPLETION_TOKENS = 1_500;

const RESERVATION_TTL_SECONDS = 120;

export interface TurnReservation {
  readonly id: string;

  readonly estimatedTokens: number;

  readonly isSettled: boolean;

  commit(actualTokens: number): Promise<void>;

  release(): void;
}

export async function reserveForTurn(
  userId: string,
  chatId: string,
  content: string,
): Promise<TurnReservation> {
  const estimatedTokens = estimateTokens(content) + EXPECTED_COMPLETION_TOKENS;
  const { reservationId } = await reserveTokens(userId, {
    kind: 'COMPLETION',
    estimatedTokens,
    ttlSeconds: RESERVATION_TTL_SECONDS,
    chatId,
  });

  let settled = false;
  return {
    id: reservationId,
    estimatedTokens,
    get isSettled() {
      return settled;
    },
    async commit(actualTokens: number): Promise<void> {
      if (settled) return;

      settled = true;
      try {
        await commitReservation(reservationId, actualTokens > 0 ? actualTokens : estimatedTokens);
      } catch (err) {
        settled = false;
        throw err;
      }
    },
    release(): void {
      if (settled) return;
      settled = true;
      void releaseReservation(reservationId).catch((err: unknown) => {
        logger.warn(
          {
            event: 'chat.release.failed',
            reservationId,
            err: err instanceof Error ? err.message : String(err),
          },
          'Failed to release chat reservation — will be swept',
        );
      });
    },
  };
}

export { AppError };
