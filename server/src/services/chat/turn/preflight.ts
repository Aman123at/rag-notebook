import { type ChatStreamEvent } from '@/contract/index.js';
import { type ChatRow, type UserRow } from '@/db/schema/index.js';
import { AppError } from '@/errors/AppError.js';
import { findChatForUser } from '@/repository/chats.repo.js';
import { findUserById } from '@/repository/users.repo.js';
import { guardQuery } from '@/security/query-guard.js';
import { assertPromptLength } from '@/services/entitlements/index.js';
import type { RunChatTurnInput } from '@/types/chats.types.js';

export type PreflightOutcome =
  | { kind: 'proceed'; user: UserRow; chat: ChatRow }
  | { kind: 'security_strike'; event: ChatStreamEvent };

export async function runPreflight(input: RunChatTurnInput): Promise<PreflightOutcome> {
  const user = await findUserById(input.userId);
  if (!user) {
    throw new AppError('UNAUTHENTICATED', 'User not found.', { exposeDetails: false });
  }
  if (user.isBlocked) {
    throw new AppError('USER_BLOCKED', 'Account is blocked.', {
      details: { reason: user.blockedReason },
      exposeDetails: true,
    });
  }

  const chat = await findChatForUser(input.userId, input.chatId);
  if (!chat) {
    throw new AppError('NOT_FOUND', 'Chat not found.', { exposeDetails: false });
  }

  await assertPromptLength(input.userId, input.content);

  const guard = await guardQuery(input.userId, input.content);
  if (guard.action === 'strike') {
    return {
      kind: 'security_strike',
      event: {
        type: 'error',
        data: {
          code: 'SECURITY_VIOLATION',
          message: guard.blocked
            ? 'Your account has been blocked after a second prompt-injection attempt.'
            : 'This message looks like a prompt-injection attempt and was rejected.',
          details: {
            strike: guard.strike,
            blocked: guard.blocked,
            category: guard.category,
          },
        },
      },
    };
  }

  return { kind: 'proceed', user, chat };
}
