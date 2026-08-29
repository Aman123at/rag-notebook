import { pgEnum } from 'drizzle-orm/pg-core';

import {
  CHAT_MODELS,
  DISLIKED_REASONS,
  FINISH_REASONS,
  MESSAGE_ROLES,
  PLAN_TIERS,
  REACTIONS,
  SOURCE_STATUSES,
  SOURCE_TYPES,
} from '@/contract/index.js';

function enumFromUnion<const T extends readonly [string, ...string[]]>(
  name: string,
  values: T,
): ReturnType<typeof pgEnum<string, [T[number], ...T[number][]]>> {
  return pgEnum(name, values as unknown as [T[number], ...T[number][]]);
}

export const planTierEnum = enumFromUnion('plan_tier', PLAN_TIERS);
export const sourceTypeEnum = enumFromUnion('source_type', SOURCE_TYPES);
export const sourceStatusEnum = enumFromUnion('source_status', SOURCE_STATUSES);
export const messageRoleEnum = enumFromUnion('message_role', MESSAGE_ROLES);
export const reactionEnum = enumFromUnion('reaction', REACTIONS);
export const dislikedReasonEnum = enumFromUnion('disliked_reason', DISLIKED_REASONS);
export const chatModelEnum = enumFromUnion('chat_model', CHAT_MODELS);
export const finishReasonEnum = enumFromUnion('finish_reason', FINISH_REASONS);

export const attackTypeEnum = pgEnum('attack_type', [
  'PROMPT_INJECTION',
  'JAILBREAK',
  'SYSTEM_PROMPT_EXTRACTION',
  'POISONED_DOCUMENT',
]);
export const attackStageEnum = pgEnum('attack_stage', ['INGESTION', 'QUERY']);
export const attackDetectorEnum = pgEnum('attack_detector', ['REGEX', 'CLASSIFIER']);

export const tokenReservationKindEnum = pgEnum('token_reservation_kind', [
  'COMPLETION',
  'EMBEDDING',
]);
export const tokenReservationStatusEnum = pgEnum('token_reservation_status', [
  'RESERVED',
  'COMMITTED',
  'RELEASED',
  'EXPIRED',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'PENDING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'REFUNDED',
]);
export const subscriptionProviderEnum = pgEnum('subscription_provider', ['RAZORPAY']);
