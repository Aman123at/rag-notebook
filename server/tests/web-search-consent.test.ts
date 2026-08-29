import { describe, expect, it } from 'vitest';

import {
  type ChatStreamEvent,
  ChatStreamEventSchema,
  encodeSSE,
  WEB_SEARCH,
} from '../src/contract/index.js';
import { assemblePrompt } from '../src/retrieval/prompt.js';
import type { RetrievedChunk } from '../src/retrieval/types.js';
import {
  isAffirmative,
  readsAsNoCoverage,
  readTurnMetadata,
} from '../src/services/chat/consent.js';
import {
  renderWebSearchExhausted,
  renderWebSearchOffer,
  renderWebSearchQuestion,
} from '../src/services/chat/tools.js';

describe('isAffirmative', () => {
  const yes = [
    'yes',
    'Yes',
    'yes please',
    'yeah',
    'yep',
    'y',
    'sure',
    'ok',
    'okay',
    'go ahead',
    'please do',
    'search the web',
    'do it',
    'haan',
    '  yes  ',
    '"yes"',
  ];
  it.each(yes)('accepts %j', (input) => {
    expect(isAffirmative(input)).toBe(true);
  });

  const no = [
    '',
    '   ',
    'no',
    'No',
    'nope',
    'nah',
    "don't",
    'do not search',
    'skip',
    'cancel',
    'nahi',

    'ok so what does the second chapter say about retrieval augmentation?',
    'yesterday I uploaded a file about this, can you find it for me please',
    'why not?',
    'maybe',
  ];
  it.each(no)('rejects %j', (input) => {
    expect(isAffirmative(input)).toBe(false);
  });

  it('rejects a long message even when it opens with "yes"', () => {
    expect(isAffirmative(`yes ${'a'.repeat(60)}`)).toBe(false);
  });
});

describe('readTurnMetadata', () => {
  it('reads a pending offer', () => {
    const meta = readTurnMetadata({ webSearchOffer: { query: 't20 world cup 2024 winner' } });
    expect(meta.webSearchOffer?.query).toBe('t20 world cup 2024 winner');
  });

  it('reads recorded usage', () => {
    const meta = readTurnMetadata({ webSearch: { used: true, query: 'q', resultCount: 5 } });
    expect(meta.webSearch?.used).toBe(true);
    expect(meta.webSearch?.resultCount).toBe(5);
  });

  it.each([null, undefined, 'a string', 42, [], { unrelated: 'legacy field' }])(
    'reads %j as empty rather than throwing',
    (raw) => {
      expect(readTurnMetadata(raw)).toEqual({});
    },
  );

  it('drops a malformed offer instead of trusting it', () => {
    expect(readTurnMetadata({ webSearchOffer: { query: '' } })).toEqual({});
    expect(readTurnMetadata({ webSearchOffer: { query: 7 } })).toEqual({});
  });
});

describe('assemblePrompt — web-search stances', () => {
  const NO_KNOWLEDGE = 'do not use outside knowledge';

  it('defaults to off and keeps the strict rule unqualified', () => {
    const p = assemblePrompt([], { contextTokenBudget: 1000 }).systemPrompt;
    expect(p).toContain(NO_KNOWLEDGE);
    expect(p).not.toContain('WEB SEARCH');
    expect(p).not.toContain('offer_web_search');
  });

  it('enabled: relaxes the rule for tool results and names the tool', () => {
    const p = assemblePrompt([], {
      contextTokenBudget: 1000,
      webSearchMode: 'enabled',
    }).systemPrompt;
    expect(p).toContain('`web_search` tool');
    expect(p).toMatch(/relaxed ONLY for material the tool returns/);
  });

  it('answering: relaxes the rule for the web block already in context', () => {
    const p = assemblePrompt([], {
      contextTokenBudget: 1000,
      webSearchMode: 'answering',
    }).systemPrompt;
    expect(p).toContain('WEB RESULTS AVAILABLE');
    expect(p).toMatch(/relaxed ONLY for the numbered/);
  });

  it('offer: describes the ask-permission tool and excludes small talk', () => {
    const p = assemblePrompt([], {
      contextTokenBudget: 1000,
      webSearchMode: 'offer',
    }).systemPrompt;
    expect(p).toContain('offer_web_search');
    expect(p).toContain('greetings');
  });

  it('exhausted: is byte-identical to off, so grounding is not relaxed', () => {
    const exhausted = assemblePrompt([], {
      contextTokenBudget: 1000,
      webSearchMode: 'exhausted',
    }).systemPrompt;
    const off = assemblePrompt([], { contextTokenBudget: 1000 }).systemPrompt;
    expect(exhausted).toBe(off);
    expect(exhausted).toContain(NO_KNOWLEDGE);
    expect(exhausted).not.toContain('web_search');
  });

  it('keeps the hard boundary and the context block in every mode', () => {
    const chunk: RetrievedChunk = {
      chunkId: '00000000-0000-4000-8000-000000000001',
      sourceId: '00000000-0000-4000-8000-000000000002',
      sourceTitle: 'Notes',
      sourceType: 'TEXT',
      locator: { kind: 'text_range', startChar: 0, endChar: 10 },
      content: 'hello world',
      chunkIndex: 0,
      tokenCount: 5,
      rank: 1,
      fusedScore: 0.5,
      deepLink: null,
    };
    for (const mode of ['off', 'enabled', 'answering', 'offer', 'exhausted'] as const) {
      const p = assemblePrompt([chunk], {
        contextTokenBudget: 1000,
        webSearchMode: mode,
      }).systemPrompt;
      expect(p).toContain('HARD BOUNDARY');
      expect(p).toContain('<chunk n="1"');
    }
  });
});

describe('readsAsNoCoverage', () => {
  const refusals = [
    "Your sources don't cover the winner of the 2024 ICC Men's T20 World Cup final.",
    "Your sources don't cover the current CEO of Starbucks.",
    'Your sources do not mention the current CEO of Starbucks.',
    "That isn't in the documents you added.",
    "The documents you added don't discuss this topic.",
    "I couldn't find anything about this in your sources.",
    "I can't find any information on that in the material you uploaded.",
  ];
  it.each(refusals)('detects %j', (input) => {
    expect(readsAsNoCoverage(input)).toBe(true);
  });

  const answers = [
    '',
    '   ',
    'Hello — what would you like to know about your sources?',
    'The espresso dial-in standard is an 18.5 gram dose into a 38 gram yield over 27 to 30 seconds [1].',
    'The Loring S15 Falcon charges the Ethiopia Guji lot at 196°C [2].',

    'Your documents cover both the Guji and the Huila roast profiles [1][2].',
  ];
  it.each(answers)('leaves %j alone', (input) => {
    expect(readsAsNoCoverage(input)).toBe(false);
  });

  it('ignores a long answer that only notes a gap in passing', () => {
    const long = `${'The handbook documents the roast profiles in detail. '.repeat(20)}Your sources don't cover pricing.`;
    expect(readsAsNoCoverage(long)).toBe(false);
  });
});

describe('renderWebSearchOffer', () => {
  it('names the query and ends in a question', () => {
    const text = renderWebSearchOffer('t20 world cup 2024 winner');
    expect(text).toContain('t20 world cup 2024 winner');
    expect(text.trim().endsWith('?')).toBe(true);

    expect(text).not.toContain('CONTEXT');
    expect(text).not.toContain('chunk');
  });

  it('is composed of the standalone question, so the append path matches', () => {
    const q = renderWebSearchQuestion('t20 world cup 2024 winner');
    expect(renderWebSearchOffer('t20 world cup 2024 winner')).toContain(q);
    expect(q.trim().endsWith('?')).toBe(true);
  });
});

describe('renderWebSearchExhausted', () => {
  it('names the cap and points at the way out', () => {
    const text = renderWebSearchExhausted(WEB_SEARCH.MAX_PER_CHAT);
    expect(text).toContain('5 web searches');
    expect(text).toContain('new chat');
    expect(text.endsWith('\n\n')).toBe(true);
  });
});

describe('web_search_offer SSE event', () => {
  it('parses and round-trips on the wire', () => {
    const event: ChatStreamEvent = {
      type: 'web_search_offer',
      data: { query: 'who won the 2024 t20 world cup', remainingSearches: 4 },
    };
    expect(ChatStreamEventSchema.parse(event)).toEqual(event);
    const frame = encodeSSE(event);
    expect(frame.startsWith('event: web_search_offer\ndata: ')).toBe(true);
    expect(frame.endsWith('\n\n')).toBe(true);
    expect(frame).not.toContain('[DONE]');
  });

  it('rejects a negative remaining count', () => {
    expect(
      ChatStreamEventSchema.safeParse({
        type: 'web_search_offer',
        data: { query: 'q', remainingSearches: -1 },
      }).success,
    ).toBe(false);
  });

  it('accepts the additive remainingSearches on tool_call', () => {
    const event: ChatStreamEvent = {
      type: 'tool_call',
      data: {
        tool: 'web_search',
        status: 'completed',
        query: 'q',
        resultCount: 5,
        remainingSearches: 4,
      },
    };
    expect(ChatStreamEventSchema.parse(event)).toEqual(event);
  });

  it('caps a chat session at five searches', () => {
    expect(WEB_SEARCH.MAX_PER_CHAT).toBe(5);
  });
});
