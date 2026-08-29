import { randomUUID } from 'node:crypto';

import type OpenAI from 'openai';

import {
  CHAT_CONTEXT,
  type ChatModel,
  type Citation,
  WEB_SEARCH,
  type WebCitation,
} from '@/contract/index.js';
import { AppError, isAppError } from '@/errors/AppError.js';
import { sendEvent } from '@/inngest/events.js';
import { extractMemories, neverThrow } from '@/integrations/mem0.js';
import { streamChat } from '@/integrations/openai.js';
import { logger } from '@/observability/logger.js';
import {
  countWebSearchesForChat,
  insertMessage,
  listMessagesForChat,
} from '@/repository/messages.repo.js';
import { assemblePrompt } from '@/retrieval/index.js';
import { getBudget } from '@/services/entitlements/index.js';
import type { RunChatTurnInput } from '@/types/chats.types.js';

import { readsAsNoCoverage, type WebSearchUsage } from './consent.js';
import { fetchExtrasForTurn } from './memory.js';
import { type SseStream } from './stream.js';
import {
  MAX_TOOL_ROUNDS,
  OFFER_WEB_SEARCH_TOOL,
  renderWebResultsBlock,
  renderWebSearchExhausted,
  renderWebSearchOffer,
  renderWebSearchQuestion,
  runWebSearch,
  toWebCitations,
  WEB_SEARCH_TOOL,
} from './tools.js';
import { persistAssistantTurn, selectCitedSubsets } from './turn/finalize.js';
import { runPreflight } from './turn/preflight.js';
import { EXPECTED_COMPLETION_TOKENS, reserveForTurn } from './turn/reservation.js';
import { retrieveForTurn } from './turn/retrieval.js';
import { consumeModelRound } from './turn/stream-round.js';
import { dispatchToolRound } from './turn/tool-round.js';
import { decideWebSearchStance, findLastAssistantMetadata } from './turn/web-search.js';

const DEFAULT_MODEL: ChatModel = 'gpt-4o-mini';

const CONTEXT_TOKEN_BUDGET = 6_000;

const CHAT_STREAM_MAX_DURATION_MS = 5 * 60 * 1_000;

export async function runChatTurn(input: RunChatTurnInput, sse: SseStream): Promise<void> {
  const preflight = await runPreflight(input);
  if (preflight.kind === 'security_strike') {
    sse.open();
    sse.emit(preflight.event);
    sse.close();
    return;
  }
  const { chat } = preflight;

  const model: ChatModel = input.model ?? DEFAULT_MODEL;
  const reservation = await reserveForTurn(input.userId, input.chatId, input.content);

  const assistantMessageId = randomUUID();
  let assistantContent = '';
  let userMessageId: string | null = null;

  sse.open();

  const maxDurationTimer = setTimeout(() => {
    if (sse.isClosed) return;
    logger.warn(
      {
        event: 'chat.stream.max_duration',
        userId: input.userId,
        chatId: input.chatId,
        assistantMessageId,
        maxDurationMs: CHAT_STREAM_MAX_DURATION_MS,
      },
      'Chat SSE exceeded max duration — aborting',
    );
    sse.abort();
  }, CHAT_STREAM_MAX_DURATION_MS);
  maxDurationTimer.unref();

  sse.onClose({
    onDisconnect: () => {
      void (async () => {
        try {
          if (userMessageId !== null) {
            await insertMessage({
              id: assistantMessageId,
              chatId: input.chatId,
              userId: input.userId,
              role: 'assistant',
              content: assistantContent,
              modelName: model,
              finishReason: 'aborted',
              consumedTokens: 0,
              responseOfMessageId: userMessageId,
            }).catch((err: unknown) => {
              logger.warn(
                {
                  event: 'chat.partial_persist.failed',
                  err: err instanceof Error ? err.message : String(err),
                },
                'Failed to persist partial assistant message on disconnect',
              );
            });
          }
        } finally {
          reservation.release();
        }
      })();
    },
  });

  try {
    const userMsg = await insertMessage({
      chatId: input.chatId,
      userId: input.userId,
      role: 'user',
      content: input.content,
      modelName: null,
      consumedTokens: 0,
    });
    userMessageId = userMsg.id;

    sse.emit({
      type: 'message_start',
      data: {
        userMessageId: userMsg.id,
        assistantMessageId,
        model,
        chatId: input.chatId,
      },
    });

    sse.emit({ type: 'retrieval', data: { status: 'started', chunkCount: 0 } });
    const retrieved = await retrieveForTurn({
      userId: input.userId,
      workspaceId: chat.workspaceId,
      chatId: input.chatId,
      query: input.content,
    });
    const retrievalUnavailable = retrieved.unavailable;
    sse.emit({
      type: 'retrieval',
      data: {
        status: retrievalUnavailable ? 'failed' : 'completed',
        chunkCount: retrieved.chunks.length,
      },
    });

    const citations: Citation[] = retrieved.citations;
    sse.emit({ type: 'citations', data: { citations } });

    const [extras, history] = await Promise.all([
      fetchExtrasForTurn(input.userId, input.chatId, input.content, chat.workspaceId),
      listMessagesForChat(input.userId, input.chatId),
    ]);
    const recent = history
      .filter((m) => m.id !== userMsg.id)
      .slice(-CHAT_CONTEXT.RECENT_MESSAGE_WINDOW);

    const pendingOffer = findLastAssistantMetadata(history, assistantMessageId).webSearchOffer;
    const searchesUsed = await countWebSearchesForChat(input.userId, input.chatId);
    const searchesRemaining = Math.max(0, WEB_SEARCH.MAX_PER_CHAT - searchesUsed);

    const { mode: webMode } = decideWebSearchStance({
      requested: input.webSearch,
      content: input.content,
      pendingOffer,
      searchesRemaining,
      retrievalUnavailable,
    });

    const webCitations: WebCitation[] = [];

    let executedSearch: WebSearchUsage | null = null;

    let offeredSearch: { query: string } | null = null;

    const executeWebSearch = async (query: string): Promise<WebCitation[]> => {
      sse.emit({ type: 'tool_call', data: { tool: 'web_search', status: 'started', query } });
      const outcome = await runWebSearch(query);
      const startIndex = citations.length + webCitations.length + 1;
      const fresh = toWebCitations(outcome, startIndex);
      webCitations.push(...fresh);
      executedSearch = { used: true, query, resultCount: fresh.length };
      sse.emit({
        type: 'tool_call',
        data: {
          tool: 'web_search',
          status: outcome.degraded ? 'failed' : 'completed',
          query,
          resultCount: fresh.length,
          remainingSearches: Math.max(0, searchesRemaining - 1),
        },
      });
      if (fresh.length > 0) {
        sse.emit({ type: 'web_citations', data: { citations: fresh } });
      }
      return fresh;
    };

    const assembled = assemblePrompt(retrieved.chunks, {
      contextTokenBudget: CONTEXT_TOKEN_BUDGET,
      extras: {
        summary: extras.summary ?? undefined,
        memories: extras.memories,
      },
      retrievalUnavailable,
      webSearchMode: webMode,
    });

    if (webMode === 'exhausted') {
      const notice = renderWebSearchExhausted(WEB_SEARCH.MAX_PER_CHAT);
      assistantContent += notice;
      sse.emit({ type: 'token', data: { delta: notice } });
    }

    let systemPrompt = assembled.systemPrompt;
    if (webMode === 'answering' && pendingOffer) {
      const fresh = await executeWebSearch(pendingOffer.query);
      systemPrompt = `${systemPrompt}\n\n${renderWebResultsBlock(fresh)}`;
    }

    let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...recent.map((m): OpenAI.Chat.Completions.ChatCompletionMessageParam => ({
        role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
        content: m.content,
      })),
      { role: 'user', content: input.content },
    ];

    let finishReason: 'stop' | 'length' | 'tool' | 'aborted' = 'stop';
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let ttftMs: number | null = null;
    const streamStartedAt = Date.now();

    for (let round = 0; round < MAX_TOOL_ROUNDS + 1; round += 1) {
      const turnTools =
        round === 0 && webMode === 'enabled' && executedSearch === null
          ? [WEB_SEARCH_TOOL]
          : round === 0 && webMode === 'offer'
            ? [OFFER_WEB_SEARCH_TOOL]
            : null;
      const streamArgs = {
        model,
        messages,
        maxCompletionTokens: EXPECTED_COMPLETION_TOKENS,
        temperature: 0.3,
        signal: sse.signal,

        observability: {
          userId: input.userId,
          workspaceId: chat.workspaceId,
          chatId: input.chatId,
          messageId: assistantMessageId,
          model,
          sourceCount: retrieved.chunks.length,
          retrievedChunkCount: retrieved.chunks.length,
          webSearch: webMode !== 'off',
          generationName: round === 0 ? 'chat.stream' : `chat.stream.round_${round}`,
        },
        ...(turnTools ? { tools: turnTools, toolChoice: 'auto' as const } : {}),
      };
      const stream = await streamChat(streamArgs);

      const outcome = await consumeModelRound(
        stream,
        {
          isClosed: () => sse.isClosed,
          onToken: (delta) => {
            assistantContent += delta;
            sse.emit({ type: 'token', data: { delta } });
          },
        },
        { promptTokens, completionTokens, totalTokens },
        streamStartedAt,
      );
      const collectedToolCalls = outcome.toolCalls;
      const roundContent = outcome.content;
      const roundFinish = outcome.finishReason;
      promptTokens = outcome.usage.promptTokens;
      completionTokens = outcome.usage.completionTokens;
      totalTokens = outcome.usage.totalTokens;
      if (ttftMs === null) ttftMs = outcome.ttftMs;
      if (outcome.aborted) finishReason = 'aborted';

      if (sse.isClosed) break;

      if (roundFinish !== 'tool_calls' || collectedToolCalls.size === 0) {
        finishReason = roundFinish === 'length' ? 'length' : 'stop';
        break;
      }

      finishReason = 'tool';
      const { nextMessages, offer: offerThisRound } = await dispatchToolRound({
        messages,
        roundContent,
        toolCalls: collectedToolCalls,
        hasExecutedSearch: () => executedSearch !== null,
        executeWebSearch,
      });

      if (offerThisRound !== null) {
        offeredSearch = offerThisRound;
        const offerText = renderWebSearchOffer(offerThisRound.query);
        if (ttftMs === null) ttftMs = Date.now() - streamStartedAt;
        assistantContent += offerText;
        sse.emit({ type: 'token', data: { delta: offerText } });
        sse.emit({
          type: 'web_search_offer',
          data: { query: offerThisRound.query, remainingSearches: searchesRemaining },
        });
        finishReason = 'stop';
        break;
      }

      messages = nextMessages;
    }

    if (sse.isClosed) {
      return;
    }

    if (webMode === 'offer' && offeredSearch === null && readsAsNoCoverage(assistantContent)) {
      const fallbackQuery = input.content.trim().replace(/\s+/g, ' ').slice(0, 200);
      if (fallbackQuery.length > 0) {
        offeredSearch = { query: fallbackQuery };
        const suffix = `${assistantContent.trimEnd().endsWith('.') ? ' ' : '. '}${renderWebSearchQuestion(fallbackQuery)}`;
        assistantContent += suffix;
        sse.emit({ type: 'token', data: { delta: suffix } });
        sse.emit({
          type: 'web_search_offer',
          data: { query: fallbackQuery, remainingSearches: searchesRemaining },
        });
      }
    }

    const cited = selectCitedSubsets(assistantContent, citations, webCitations);
    const usedCitations = cited.citations;
    const usedWebCitations = cited.webCitations;
    if (cited.citationsNarrowed) {
      sse.emit({ type: 'citations', data: { citations: usedCitations } });
    }
    if (cited.webCitationsNarrowed) {
      sse.emit({ type: 'web_citations', data: { citations: usedWebCitations } });
    }

    const consumedTokens = totalTokens > 0 ? totalTokens : promptTokens + completionTokens;
    await persistAssistantTurn({
      assistantMessageId,
      chatId: input.chatId,
      userId: input.userId,
      content: assistantContent,
      model,
      promptTokens,
      completionTokens,
      consumedTokens,
      finishReason,
      responseOfMessageId: userMsg.id,
      citations: usedCitations,
      webCitations: usedWebCitations,
      executedSearch,
      offeredSearch,
    });

    const commitTotal = consumedTokens > 0 ? consumedTokens : reservation.estimatedTokens;
    await reservation.commit(commitTotal);

    const budget = await getBudget(input.userId);
    sse.emit({
      type: 'usage',
      data: {
        promptTokens,
        completionTokens,
        totalTokens: commitTotal,
        remainingTokens: budget.remaining,
      },
    });
    sse.emit({
      type: 'message_end',
      data: { assistantMessageId, finishReason },
    });

    const streamDurationMs = Date.now() - streamStartedAt;
    logger.info(
      {
        event: 'chat.turn.completed',
        userId: input.userId,
        chatId: input.chatId,
        assistantMessageId,
        model,
        promptTokens,
        completionTokens,
        totalTokens: commitTotal,
        ttftMs,
        streamDurationMs,
        finishReason,
        retrievedChunkCount: retrieved.chunks.length,
        webSearchMode: webMode,
        webSearchUsed: executedSearch !== null,
        webSearchOffered: offeredSearch !== null,
        webSearchesRemaining:
          executedSearch !== null ? Math.max(0, searchesRemaining - 1) : searchesRemaining,
      },
      'chat turn completed',
    );

    clearTimeout(maxDurationTimer);
    sse.close();

    neverThrow(async () => {
      await extractMemories(
        input.userId,
        input.chatId,
        { userContent: input.content, assistantContent },
        chat.workspaceId,
      );
    });

    const nextMessageCount = (chat.messageCount ?? 0) + 2;
    if (nextMessageCount > 0 && nextMessageCount % CHAT_CONTEXT.SUMMARY_INTERVAL === 0) {
      void sendEvent(
        'chat/summarize.requested',
        { chatId: input.chatId, userId: input.userId },
        { idempotencyKey: `${input.chatId}:${nextMessageCount}` },
      ).catch((err: unknown) => {
        logger.warn(
          {
            event: 'chat.summarize.enqueue.failed',
            err: err instanceof Error ? err.message : String(err),
          },
          'Failed to enqueue chat/summarize.requested — non-fatal',
        );
      });
    }
  } catch (err) {
    if (sse.isClosed) {
      return;
    }
    const app = isAppError(err)
      ? err
      : new AppError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err), {
          exposeDetails: false,
        });
    logger.error(
      {
        event: 'chat.pipeline.failed',
        userId: input.userId,
        chatId: input.chatId,
        code: app.code,
        err: app.message,
      },
      'Chat pipeline failed after stream open',
    );
    sse.emit({
      type: 'error',
      data: {
        code: app.code,
        message: app.message,
        ...(app.exposeDetails && app.details !== undefined ? { details: app.details } : {}),
      },
    });
    clearTimeout(maxDurationTimer);
    sse.close();
    reservation.release();
  } finally {
    clearTimeout(maxDurationTimer);

    reservation.release();
  }
}
