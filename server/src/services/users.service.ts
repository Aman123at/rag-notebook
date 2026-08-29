import { FREE_PLAN_LIMITS, type Me, PLAN_LIMITS, type PlanLimitsWire } from '@/contract/index.js';
import { withTransaction } from '@/db/client.js';
import { type UserRow } from '@/db/schema/index.js';
import { AppError } from '@/errors/AppError.js';
import { logger } from '@/observability/logger.js';
import { markWebhookProcessed, recordWebhookEvent } from '@/repository/billing.repo.js';
import {
  anonymiseUserByClerkId,
  countWorkspacesForUser,
  findUserByClerkId,
  findUserById,
  insertUserIfNotExists,
  updateUserByClerkId,
  updateUserProfile,
} from '@/repository/users.repo.js';

export async function provisionOrGetUser(input: {
  clerkUserId: string;
  email: string;
  displayName: string | null;
  signUpType: string | null;
}): Promise<UserRow> {
  const existing = await findUserByClerkId(input.clerkUserId);
  if (existing) return existing;

  return withTransaction(async (tx) => {
    return insertUserIfNotExists(
      {
        clerkUserId: input.clerkUserId,
        email: input.email,
        displayName: input.displayName,
        signUpType: input.signUpType,
        planTier: 'FREE',
        assignedTokens:
          FREE_PLAN_LIMITS.lifetimeTokens === null ? null : BigInt(FREE_PLAN_LIMITS.lifetimeTokens),
      },
      tx,
    );
  });
}

export async function getMe(userId: string): Promise<Me> {
  return buildMePayload(await loadLiveUser(userId));
}

export async function updateMe(
  userId: string,
  patch: { displayName?: string | undefined },
): Promise<Me> {
  return applyUpdateMe(await loadLiveUser(userId), patch);
}

async function loadLiveUser(userId: string): Promise<UserRow> {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError('UNAUTHENTICATED', 'User record no longer exists.', {
      exposeDetails: false,
    });
  }
  return user;
}

export async function buildMePayload(user: UserRow): Promise<Me> {
  if (user.isBlocked) {
    throw new AppError('USER_BLOCKED', 'User is blocked.', { exposeDetails: false });
  }
  const limits = PLAN_LIMITS[user.planTier] as PlanLimitsWire;
  const assignedNum = user.assignedTokens === null ? null : Number(user.assignedTokens);
  const usedEmbedding = Number(user.usedTokensEmbedding);
  const usedCompletion = Number(user.usedTokensCompletion);
  const remaining =
    assignedNum === null ? null : Math.max(0, assignedNum - usedEmbedding - usedCompletion);
  const workspaces = await countWorkspacesForUser(user.id);

  const overCaps =
    user.planTier === 'FREE' &&
    FREE_PLAN_LIMITS.maxWorkspaces !== null &&
    workspaces > FREE_PLAN_LIMITS.maxWorkspaces;

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    planTier: user.planTier,
    isActive: user.isActive,
    isBlocked: user.isBlocked,
    tokens: {
      assigned: assignedNum,
      usedEmbedding,
      usedCompletion,
      remaining,
    },
    limits,
    usage: { workspaces, overCaps },
  };
}

export async function applyUpdateMe(
  user: UserRow,
  patch: { displayName?: string | undefined },
): Promise<Me> {
  const updated =
    patch.displayName === undefined
      ? user
      : ((await updateUserProfile(user.id, { displayName: patch.displayName })) ?? user);
  return buildMePayload(updated);
}

function readUserPayload(data: Record<string, unknown>): ClerkUserPayload {
  const id = typeof data['id'] === 'string' ? data['id'] : null;
  if (!id) {
    throw new AppError('VALIDATION_ERROR', 'Clerk webhook payload missing user id.', {
      exposeDetails: false,
    });
  }
  const emailAddresses = Array.isArray(data['email_addresses'])
    ? (data['email_addresses'] as ReadonlyArray<{ id: string; email_address: string }>)
    : [];
  const externalAccounts = Array.isArray(data['external_accounts'])
    ? (data['external_accounts'] as ReadonlyArray<{ provider?: string }>)
    : [];
  return {
    id,
    primary_email_address_id:
      typeof data['primary_email_address_id'] === 'string'
        ? data['primary_email_address_id']
        : null,
    email_addresses: emailAddresses,
    first_name: typeof data['first_name'] === 'string' ? data['first_name'] : null,
    last_name: typeof data['last_name'] === 'string' ? data['last_name'] : null,
    username: typeof data['username'] === 'string' ? data['username'] : null,
    external_accounts: externalAccounts,
  };
}

export async function handleClerkWebhookEvent(input: {
  svixId: string;
  envelope: { type: string; data: Record<string, unknown> };
  requestId: string;
}): Promise<{ outcome: 'ignored' | 'processed' | 'replay' }> {
  const { envelope, requestId, svixId } = input;
  const { data, type } = envelope;

  const isFirst = await recordWebhookEvent('clerk', svixId, envelope);
  if (!isFirst) {
    logger.info({ requestId, svixId, type }, 'clerk webhook replay ignored');
    return { outcome: 'replay' };
  }

  let outcome: 'ignored' | 'processed' = 'processed';
  switch (type) {
    case 'user.created':
      await onClerkUserCreated(readUserPayload(data));
      break;
    case 'user.updated':
      await onClerkUserUpdated(readUserPayload(data));
      break;
    case 'user.deleted': {
      const id = typeof data['id'] === 'string' ? data['id'] : null;
      if (id) await onClerkUserDeleted(id);
      break;
    }
    default:
      logger.debug({ requestId, type }, 'clerk webhook event ignored (no handler)');
      outcome = 'ignored';
      break;
  }

  await markWebhookProcessed('clerk', svixId);
  return { outcome };
}

interface ClerkUserPayload {
  id: string;
  primary_email_address_id: string | null;
  email_addresses: ReadonlyArray<{ id: string; email_address: string }>;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  external_accounts: ReadonlyArray<{ provider?: string }>;
}

export function pickPrimaryEmail(payload: {
  primary_email_address_id: string | null;
  email_addresses: ReadonlyArray<{ id: string; email_address: string }>;
}): string | null {
  const primaryId = payload.primary_email_address_id;
  if (primaryId) {
    const match = payload.email_addresses.find((e) => e.id === primaryId);
    if (match) return match.email_address;
  }
  const first = payload.email_addresses[0];
  return first ? first.email_address : null;
}

export function pickDisplayName(payload: {
  first_name: string | null;
  last_name: string | null;
  username: string | null;
}): string | null {
  const joined = [payload.first_name, payload.last_name].filter((s): s is string => !!s).join(' ');
  if (joined.length > 0) return joined;
  return payload.username;
}

export function pickSignUpType(payload: {
  external_accounts: ReadonlyArray<{ provider?: string }>;
}): string | null {
  const first = payload.external_accounts[0];
  return first?.provider ?? null;
}

export async function onClerkUserCreated(payload: {
  id: string;
  primary_email_address_id: string | null;
  email_addresses: ReadonlyArray<{ id: string; email_address: string }>;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  external_accounts: ReadonlyArray<{ provider?: string }>;
}): Promise<void> {
  const email = pickPrimaryEmail(payload);
  if (!email) return;
  await provisionOrGetUser({
    clerkUserId: payload.id,
    email,
    displayName: pickDisplayName(payload),
    signUpType: pickSignUpType(payload),
  });
}

export async function onClerkUserUpdated(payload: {
  id: string;
  primary_email_address_id: string | null;
  email_addresses: ReadonlyArray<{ id: string; email_address: string }>;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  external_accounts: ReadonlyArray<{ provider?: string }>;
}): Promise<void> {
  const email = pickPrimaryEmail(payload);
  if (!email) return;
  const displayName = pickDisplayName(payload);
  const updated = await updateUserByClerkId(payload.id, { email, displayName });
  if (!updated) {
    await provisionOrGetUser({
      clerkUserId: payload.id,
      email,
      displayName,
      signUpType: pickSignUpType(payload),
    });
  }
}

export async function onClerkUserDeleted(clerkUserId: string): Promise<void> {
  await anonymiseUserByClerkId(clerkUserId);
}
