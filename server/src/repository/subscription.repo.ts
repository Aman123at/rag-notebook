import { and, desc, eq, sql } from 'drizzle-orm';

import { FREE_PLAN_LIMITS } from '@/contract/index.js';
import { exec, type Executor, withTransaction } from '@/db/client.js';
import { type SubscriptionRow, subscriptions, users } from '@/db/schema/index.js';
import type { PendingSubscriptionInput, UpgradeInput } from '@/types/subscription.types.js';

export async function insertPendingSubscription(
  input: PendingSubscriptionInput,
  tx?: Executor,
): Promise<SubscriptionRow | null> {
  const [row] = await exec(tx)
    .insert(subscriptions)
    .values({
      userId: input.userId,
      plan: 'PRO',
      provider: 'RAZORPAY',
      providerOrderId: input.providerOrderId,
      status: 'PENDING',
      amountMinor: input.amountMinor,
      currency: input.currency,
    })
    .onConflictDoNothing({
      target: [subscriptions.provider, subscriptions.providerOrderId],
    })
    .returning();
  return row ?? null;
}

export async function findSubscriptionByOrderId(
  providerOrderId: string,
  tx?: Executor,
): Promise<SubscriptionRow | null> {
  const rows = await exec(tx)
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.provider, 'RAZORPAY'),
        eq(subscriptions.providerOrderId, providerOrderId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function findLatestActiveSubscriptionForUser(
  userId: string,
  tx?: Executor,
): Promise<SubscriptionRow | null> {
  const rows = await exec(tx)
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'ACTIVE')))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function upgradeUserToPro(input: UpgradeInput): Promise<boolean> {
  return withTransaction(async (tx) => {
    const [current] = await tx
      .select({ planTier: users.planTier })
      .from(users)
      .where(eq(users.id, input.userId))
      .for('update');
    if (!current) throw new Error('upgradeUserToPro: user not found');

    await tx
      .insert(subscriptions)
      .values({
        userId: input.userId,
        plan: 'PRO',
        provider: 'RAZORPAY',
        providerOrderId: input.providerOrderId,
        providerPaymentId: input.providerPaymentId,
        status: 'ACTIVE',
        amountMinor: input.amountMinor,
        currency: input.currency,
        ...(input.payload !== undefined ? { payload: input.payload } : {}),
      })
      .onConflictDoUpdate({
        target: [subscriptions.provider, subscriptions.providerOrderId],
        set: {
          providerPaymentId: input.providerPaymentId,
          status: 'ACTIVE',
          amountMinor: input.amountMinor,
          currency: input.currency,
          ...(input.payload !== undefined ? { payload: input.payload } : {}),
          updatedAt: sql`now()`,
        },
      });

    if (current.planTier === 'PRO') {
      return false;
    }

    await tx
      .update(users)
      .set({
        planTier: 'PRO',
        assignedTokens: null,
        planUpdatedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, input.userId));
    return true;
  });
}

export async function downgradeUserToFree(input: {
  userId: string;
  providerOrderId?: string;
  nextStatus: 'REFUNDED' | 'CANCELED';
  payload?: unknown;
}): Promise<boolean> {
  return withTransaction(async (tx) => {
    if (input.providerOrderId) {
      await tx
        .update(subscriptions)
        .set({
          status: input.nextStatus,
          ...(input.payload !== undefined ? { payload: input.payload } : {}),
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(subscriptions.provider, 'RAZORPAY'),
            eq(subscriptions.providerOrderId, input.providerOrderId),
          ),
        );
    }

    const [current] = await tx
      .select({ planTier: users.planTier })
      .from(users)
      .where(eq(users.id, input.userId))
      .for('update');
    if (!current) throw new Error('downgradeUserToFree: user not found');
    if (current.planTier === 'FREE') return false;

    await tx
      .update(users)
      .set({
        planTier: 'FREE',
        assignedTokens:
          FREE_PLAN_LIMITS.lifetimeTokens === null ? null : BigInt(FREE_PLAN_LIMITS.lifetimeTokens),
        planUpdatedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, input.userId));
    return true;
  });
}

export async function markSubscriptionFailed(
  providerOrderId: string,
  payload: unknown,
  tx?: Executor,
): Promise<void> {
  await exec(tx)
    .update(subscriptions)
    .set({
      status: 'PAST_DUE',
      payload: payload,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(subscriptions.provider, 'RAZORPAY'),
        eq(subscriptions.providerOrderId, providerOrderId),
      ),
    );
}
