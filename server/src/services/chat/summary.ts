import { and, eq, sql } from 'drizzle-orm';

import { env } from '@/config/env.js';
import { withTransaction } from '@/db/client.js';
import { chats } from '@/db/schema/index.js';
import { completeChat } from '@/integrations/openai.js';
import { logger } from '@/observability/logger.js';
import { listMessagesForChat } from '@/repository/messages.repo.js';
import {
  commitReservation,
  estimateTokens,
  releaseReservation,
  reserveTokens,
} from '@/services/entitlements/index.js';
import type { SummarisationResult } from '@/types/chats.types.js';

const SUMMARY_MAX_MESSAGES = 40;
const SUMMARY_MAX_COMPLETION_TOKENS = 400;

const SYSTEM_PROMPT = [
  'You are a concise chat summariser.',
  'Given the ordered messages of an ongoing conversation, produce a short (≤150 words) rolling summary that preserves:',
  '- the user’s current goal and any open questions,',
  '- decisions the assistant has confirmed,',
  '- named entities, files, and URLs that recur.',
  'Do NOT include the greeting turn or repeat verbatim wording.',
  'Reply with only the summary text.',
].join(' ');

export async function regenerateChatSummary(
  userId: string,
  chatId: string,
): Promise<SummarisationResult> {
  const messages = (await listMessagesForChat(userId, chatId)).slice(-SUMMARY_MAX_MESSAGES);
  if (messages.length < 2) {
    return { chatId, updated: false, reason: 'insufficient_messages' };
  }

  const flattened = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const estimated = estimateTokens(flattened) + SUMMARY_MAX_COMPLETION_TOKENS;

  const reservation = await reserveTokens(userId, {
    kind: 'COMPLETION',
    estimatedTokens: estimated,
    ttlSeconds: 120,
    chatId,
  });

  try {
    const completion = await completeChat({
      model: env.CHAT_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: flattened },
      ],
      maxCompletionTokens: SUMMARY_MAX_COMPLETION_TOKENS,
      temperature: 0.2,
    });

    const summary = completion.choices[0]?.message?.content?.trim() ?? '';
    const usage = completion.usage?.total_tokens ?? estimated;

    await commitReservation(reservation.reservationId, usage);

    if (summary.length === 0) {
      return { chatId, updated: false, reason: 'empty_summary', tokensConsumed: usage };
    }

    await withTransaction(async (tx) => {
      await tx
        .update(chats)
        .set({ summary, summaryUpdatedAt: sql`now()`, updatedAt: sql`now()` })
        .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));
    });

    logger.info(
      {
        event: 'chat.summary.regenerated',
        chatId,
        userId,
        tokensConsumed: usage,
        summaryChars: summary.length,
      },
      'Chat rolling summary regenerated',
    );
    return { chatId, updated: true, tokensConsumed: usage };
  } catch (err) {
    await releaseReservation(reservation.reservationId);
    throw err;
  }
}
