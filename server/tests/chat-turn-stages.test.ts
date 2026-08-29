import { afterEach, describe, expect, it, vi } from 'vitest';

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';
process.env['LOG_LEVEL'] = 'silent';
process.env['APP_URL'] = 'http://localhost:3000';
process.env['CLIENT_ORIGINS'] = 'http://localhost:5173';
process.env['DATABASE_URL'] = 'postgres://postgres:postgres@localhost:5432/rag_notebook';

const { decideWebSearchStance, findLastAssistantMetadata, parseToolQuery } =
  await import('../src/services/chat/turn/web-search.js');
const { consumeModelRound } = await import('../src/services/chat/turn/stream-round.js');
const { dispatchToolRound } = await import('../src/services/chat/turn/tool-round.js');
const { extractReferencedIndices, selectCitedSubsets } =
  await import('../src/services/chat/turn/finalize.js');

const entitlements = await import('../src/services/entitlements/index.js');
const { reserveForTurn } = await import('../src/services/chat/turn/reservation.js');

describe('decideWebSearchStance', () => {
  const base = {
    requested: false,
    content: 'what is attention?',
    pendingOffer: undefined,
    searchesRemaining: 5,
    retrievalUnavailable: false,
  };

  it('offers when the corpus is available and quota remains', () => {
    expect(decideWebSearchStance(base)).toEqual({ mode: 'offer', acceptedOffer: false });
  });

  it('searches when the client explicitly asked', () => {
    expect(decideWebSearchStance({ ...base, requested: true })).toEqual({
      mode: 'enabled',
      acceptedOffer: false,
    });
  });

  it('answers from a standing offer the user accepted with a bare yes', () => {
    expect(
      decideWebSearchStance({ ...base, content: 'yes please', pendingOffer: { query: 'q' } }),
    ).toEqual({ mode: 'answering', acceptedOffer: true });
  });

  it('does NOT treat a bare yes as consent when no offer is on the table', () => {
    expect(decideWebSearchStance({ ...base, content: 'yes please' })).toEqual({
      mode: 'offer',
      acceptedOffer: false,
    });
  });

  it('does not offer when the quota is spent', () => {
    expect(decideWebSearchStance({ ...base, searchesRemaining: 0 })).toEqual({
      mode: 'off',
      acceptedOffer: false,
    });
  });

  it('reports exhausted rather than searching when the user asks with no quota', () => {
    expect(decideWebSearchStance({ ...base, requested: true, searchesRemaining: 0 })).toEqual({
      mode: 'exhausted',
      acceptedOffer: false,
    });
  });

  it('reports exhausted when an accepted offer has no quota behind it', () => {
    expect(
      decideWebSearchStance({
        ...base,
        content: 'yes',
        pendingOffer: { query: 'q' },
        searchesRemaining: 0,
      }),
    ).toEqual({ mode: 'exhausted', acceptedOffer: true });
  });

  it('does not offer when retrieval failed — an offer needs a corpus to miss', () => {
    expect(decideWebSearchStance({ ...base, retrievalUnavailable: true })).toEqual({
      mode: 'off',
      acceptedOffer: false,
    });
  });

  it('still honours an explicit request when retrieval failed', () => {
    expect(decideWebSearchStance({ ...base, requested: true, retrievalUnavailable: true })).toEqual(
      { mode: 'enabled', acceptedOffer: false },
    );
  });
});

describe('findLastAssistantMetadata', () => {
  const offer = { webSearchOffer: { query: 'kubernetes 1.30 release date' } };

  it('reads the most recent assistant message', () => {
    const history = [
      { id: 'a', role: 'assistant', metadata: { webSearchOffer: { query: 'old' } } },
      { id: 'b', role: 'user', metadata: null },
      { id: 'c', role: 'assistant', metadata: offer },
    ];
    expect(findLastAssistantMetadata(history, 'in-flight')).toEqual(offer);
  });

  it('skips the in-flight assistant message', () => {
    const history = [
      { id: 'c', role: 'assistant', metadata: offer },
      { id: 'in-flight', role: 'assistant', metadata: { webSearchOffer: { query: 'nope' } } },
    ];
    expect(findLastAssistantMetadata(history, 'in-flight')).toEqual(offer);
  });

  it('returns empty metadata when there is no assistant turn yet', () => {
    expect(findLastAssistantMetadata([{ id: 'a', role: 'user', metadata: null }], 'x')).toEqual({});
  });
});

describe('parseToolQuery', () => {
  it('reads the query argument', () => {
    expect(parseToolQuery('{"query":"  spaced  "}')).toBe('spaced');
  });
  it('bounds the query at 400 chars', () => {
    expect(parseToolQuery(JSON.stringify({ query: 'x'.repeat(600) }))).toHaveLength(400);
  });
  it.each(['', '{', '{"query":42}', '{}'])('returns empty for malformed input %j', (raw) => {
    expect(parseToolQuery(raw)).toBe('');
  });
});

const ZERO = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

// eslint-disable-next-line @typescript-eslint/require-await
async function* chunks(...items: unknown[]): AsyncGenerator<never, void, unknown> {
  for (const i of items) yield i as never;
}

describe('consumeModelRound', () => {
  const open = { isClosed: () => false, onToken: () => undefined };

  it('forwards every content delta in order and accumulates the content', async () => {
    const seen: string[] = [];
    const out = await consumeModelRound(
      chunks(
        { choices: [{ delta: { content: 'Hel' } }] },
        { choices: [{ delta: { content: 'lo' } }] },
        { choices: [{ delta: {}, finish_reason: 'stop' }] },
      ),
      { isClosed: () => false, onToken: (d) => seen.push(d) },
      ZERO,
      Date.now(),
    );
    expect(seen).toEqual(['Hel', 'lo']);
    expect(out.content).toBe('Hello');
    expect(out.finishReason).toBe('stop');
    expect(out.aborted).toBe(false);
  });

  it('stops reading the moment the client disconnects', async () => {
    const seen: string[] = [];
    let closed = false;
    const out = await consumeModelRound(
      chunks(
        { choices: [{ delta: { content: 'first' } }] },
        { choices: [{ delta: { content: 'second' } }] },
        { choices: [{ delta: { content: 'third' } }] },
      ),
      {
        isClosed: () => closed,
        onToken: (d) => {
          seen.push(d);
          closed = true;
        },
      },
      ZERO,
      Date.now(),
    );
    expect(seen).toEqual(['first']);
    expect(out.aborted).toBe(true);
  });

  it('reassembles a tool call split across chunks', async () => {
    const out = await consumeModelRound(
      chunks(
        { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1' }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'web_search' } }] } }] },
        {
          choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"que' } }] } }],
        },
        {
          choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'ry":"x"}' } }] } }],
        },
        { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
      ),
      open,
      ZERO,
      Date.now(),
    );
    expect(out.finishReason).toBe('tool_calls');
    expect(out.toolCalls.get(0)).toEqual({
      id: 'call_1',
      name: 'web_search',
      argsBuffer: '{"query":"x"}',
    });
  });

  it('keeps parallel tool calls separate by index', async () => {
    const out = await consumeModelRound(
      chunks(
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: 'a', function: { name: 'web_search', arguments: '{}' } },
                  { index: 1, id: 'b', function: { name: 'web_search', arguments: '{}' } },
                ],
              },
            },
          ],
        },
        { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
      ),
      open,
      ZERO,
      Date.now(),
    );
    expect(out.toolCalls.size).toBe(2);
  });

  it('carries usage from the terminal chunk and keeps prior values for absent fields', async () => {
    const out = await consumeModelRound(
      chunks(
        { choices: [{ delta: { content: 'x' }, finish_reason: 'stop' }] },
        { choices: [{ delta: {} }], usage: { completion_tokens: 9 } },
      ),
      open,
      { promptTokens: 7, completionTokens: 0, totalTokens: 11 },
      Date.now(),
    );
    expect(out.usage).toEqual({ promptTokens: 7, completionTokens: 9, totalTokens: 11 });
  });

  it('normalises an unrecognised finish reason to stop', async () => {
    const out = await consumeModelRound(
      chunks({ choices: [{ delta: {}, finish_reason: 'content_filter' }] }),
      open,
      ZERO,
      Date.now(),
    );
    expect(out.finishReason).toBe('stop');
  });

  it('reports no TTFT when the round produced no content', async () => {
    const out = await consumeModelRound(
      chunks({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      open,
      ZERO,
      Date.now(),
    );
    expect(out.ttftMs).toBeNull();
  });
});

describe('dispatchToolRound', () => {
  const call = (name: string, id: string, args = '{"query":"q"}') =>
    new Map([[0, { id, name, argsBuffer: args }]]);

  it('replies to every call so the next round is well formed', async () => {
    const out = await dispatchToolRound({
      messages: [{ role: 'user', content: 'hi' }],
      roundContent: '',
      toolCalls: call('web_search', 'c1'),
      hasExecutedSearch: () => false,
      executeWebSearch: () => Promise.resolve([]),
    });

    expect(out.nextMessages).toHaveLength(3);
    expect(out.nextMessages[2]).toMatchObject({ role: 'tool', tool_call_id: 'c1' });
  });

  it('never searches on an offer — it asks', async () => {
    const executeWebSearch = vi.fn(() => Promise.resolve([]));
    const out = await dispatchToolRound({
      messages: [],
      roundContent: '',
      toolCalls: call('offer_web_search', 'c1', '{"query":"latest k8s"}'),
      hasExecutedSearch: () => false,
      executeWebSearch,
    });
    expect(executeWebSearch).not.toHaveBeenCalled();
    expect(out.offer).toEqual({ query: 'latest k8s' });
  });

  it('honours the first web_search and refuses the rest in the same round', async () => {
    let executed = false;
    const executeWebSearch = vi.fn(() => {
      executed = true;
      return Promise.resolve([]);
    });
    const out = await dispatchToolRound({
      messages: [],
      roundContent: '',
      toolCalls: new Map([
        [0, { id: 'a', name: 'web_search', argsBuffer: '{"query":"one"}' }],
        [1, { id: 'b', name: 'web_search', argsBuffer: '{"query":"two"}' }],
      ]),
      hasExecutedSearch: () => executed,
      executeWebSearch,
    });
    expect(executeWebSearch).toHaveBeenCalledTimes(1);
    const refusal = out.nextMessages.at(-1);
    expect(refusal?.role).toBe('tool');
    expect(JSON.stringify(refusal?.content)).toContain(
      'Only one web search is allowed per message',
    );
  });

  it('refuses a search outright when one already ran earlier this turn', async () => {
    const executeWebSearch = vi.fn(() => Promise.resolve([]));
    await dispatchToolRound({
      messages: [],
      roundContent: '',
      toolCalls: call('web_search', 'c1'),
      hasExecutedSearch: () => true,
      executeWebSearch,
    });
    expect(executeWebSearch).not.toHaveBeenCalled();
  });

  it('refuses an unknown tool rather than ignoring it', async () => {
    const out = await dispatchToolRound({
      messages: [],
      roundContent: '',
      toolCalls: call('delete_everything', 'c1'),
      hasExecutedSearch: () => false,
      executeWebSearch: () => Promise.resolve([]),
    });
    expect(out.nextMessages.at(-1)).toMatchObject({ content: 'Tool not available.' });
    expect(out.offer).toBeNull();
  });

  it('ignores an offer with an empty query', async () => {
    const out = await dispatchToolRound({
      messages: [],
      roundContent: '',
      toolCalls: call('offer_web_search', 'c1', '{}'),
      hasExecutedSearch: () => false,
      executeWebSearch: () => Promise.resolve([]),
    });
    expect(out.offer).toBeNull();
  });
});

describe('extractReferencedIndices', () => {
  it.each([
    ['plain [1] marker', [1]],
    ['comma form [1,3]', [1, 3]],
    ['spaced [2, 4]', [2, 4]],
    ['cluster [1][2]', [1, 2]],
    ['no markers at all', []],
    ['zero [0] is not a citation', []],
  ])('%s', (content, expected) => {
    expect([...extractReferencedIndices(content)].sort((a, b) => a - b)).toEqual(expected);
  });
});

describe('selectCitedSubsets', () => {
  type Citations = Parameters<typeof selectCitedSubsets>[1];
  type WebCitations = Parameters<typeof selectCitedSubsets>[2];
  const citations = [
    { index: 1, chunkId: 'a', score: 0.9 },
    { index: 2, chunkId: 'b', score: 0.8 },
  ] as unknown as Citations;
  const webCitations = [
    { index: 3, url: 'https://x', title: 't', snippet: 's' },
  ] as unknown as WebCitations;

  it('keeps only the cited chunks and flags the narrowing', () => {
    const out = selectCitedSubsets('answer [1]', citations, []);
    expect(out.citations).toHaveLength(1);
    expect(out.citationsNarrowed).toBe(true);
    expect(out.webCitationsNarrowed).toBe(false);
  });

  it('does not flag a narrowing when everything was cited', () => {
    const out = selectCitedSubsets('both [1][2]', citations, []);
    expect(out.citations).toHaveLength(2);
    expect(out.citationsNarrowed).toBe(false);
  });

  it('drops every citation when the answer cites nothing', () => {
    const out = selectCitedSubsets('The sources do not cover this.', citations, webCitations);
    expect(out.citations).toEqual([]);
    expect(out.webCitations).toEqual([]);
    expect(out.citationsNarrowed).toBe(true);
    expect(out.webCitationsNarrowed).toBe(true);
  });

  it('never flags a web narrowing when there were no web citations', () => {
    const out = selectCitedSubsets('no markers', citations, []);
    expect(out.webCitationsNarrowed).toBe(false);
  });
});

describe('reserveForTurn', () => {
  function stubLedger(): {
    commit: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  } {
    vi.spyOn(entitlements, 'reserveTokens').mockResolvedValue({
      reservationId: 'res-1',
      plan: 'PRO',
    });
    const commit = vi.fn(() => Promise.resolve({ status: 'committed' as const }));
    const release = vi.fn(() => Promise.resolve());
    vi.spyOn(entitlements, 'commitReservation').mockImplementation(commit);
    vi.spyOn(entitlements, 'releaseReservation').mockImplementation(release);
    return { commit, release };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sizes the reservation as prompt estimate plus the expected completion', async () => {
    stubLedger();
    const r = await reserveForTurn('u1', 'c1', 'hello');
    expect(r.estimatedTokens).toBe(entitlements.estimateTokens('hello') + 1_500);
    expect(r.isSettled).toBe(false);
  });

  it('commits real usage once', async () => {
    const { commit } = stubLedger();
    const r = await reserveForTurn('u1', 'c1', 'hello');
    await r.commit(120);
    expect(commit).toHaveBeenCalledExactlyOnceWith('res-1', 120);
    expect(r.isSettled).toBe(true);
  });

  it('falls back to the estimate when the upstream reported no usage', async () => {
    const { commit } = stubLedger();
    const r = await reserveForTurn('u1', 'c1', 'hello');
    await r.commit(0);
    expect(commit).toHaveBeenCalledExactlyOnceWith('res-1', r.estimatedTokens);
  });

  it('releases once', async () => {
    const { release } = stubLedger();
    const r = await reserveForTurn('u1', 'c1', 'hello');
    r.release();
    expect(release).toHaveBeenCalledExactlyOnceWith('res-1');
    expect(r.isSettled).toBe(true);
  });

  it('ignores a second release — the finally block cannot double-release', async () => {
    const { release } = stubLedger();
    const r = await reserveForTurn('u1', 'c1', 'hello');
    r.release();
    r.release();
    r.release();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('ignores a release after a commit — a settled turn cannot give tokens back', async () => {
    const { commit, release } = stubLedger();
    const r = await reserveForTurn('u1', 'c1', 'hello');
    await r.commit(90);
    r.release();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
  });

  it('ignores a commit after a release — a disconnect wins over a late finalise', async () => {
    const { commit, release } = stubLedger();
    const r = await reserveForTurn('u1', 'c1', 'hello');
    r.release();
    await r.commit(90);
    expect(release).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
  });

  it('stays releasable when the commit itself fails', async () => {
    vi.spyOn(entitlements, 'reserveTokens').mockResolvedValue({
      reservationId: 'res-1',
      plan: 'PRO',
    });
    vi.spyOn(entitlements, 'commitReservation').mockRejectedValue(new Error('tx aborted'));
    const release = vi.fn(() => Promise.resolve());
    vi.spyOn(entitlements, 'releaseReservation').mockImplementation(release);

    const r = await reserveForTurn('u1', 'c1', 'hello');
    await expect(r.commit(120)).rejects.toThrow('tx aborted');
    expect(r.isSettled).toBe(false);

    r.release();
    expect(release).toHaveBeenCalledExactlyOnceWith('res-1');
    expect(r.isSettled).toBe(true);
  });

  it('blocks a concurrent release while a commit is still in flight', async () => {
    vi.spyOn(entitlements, 'reserveTokens').mockResolvedValue({
      reservationId: 'res-1',
      plan: 'PRO',
    });
    let finishCommit: () => void = () => undefined;
    vi.spyOn(entitlements, 'commitReservation').mockImplementation(
      () =>
        new Promise((resolve) => {
          finishCommit = () => resolve({ status: 'committed' as const });
        }),
    );
    const release = vi.fn(() => Promise.resolve());
    vi.spyOn(entitlements, 'releaseReservation').mockImplementation(release);

    const r = await reserveForTurn('u1', 'c1', 'hello');
    const pending = r.commit(120);

    r.release();
    expect(release).not.toHaveBeenCalled();

    finishCommit();
    await pending;
    expect(r.isSettled).toBe(true);
    expect(release).not.toHaveBeenCalled();
  });

  it('swallows a release failure so a socket-close handler cannot throw', async () => {
    vi.spyOn(entitlements, 'reserveTokens').mockResolvedValue({
      reservationId: 'res-1',
      plan: 'PRO',
    });
    vi.spyOn(entitlements, 'releaseReservation').mockRejectedValue(new Error('db down'));
    const r = await reserveForTurn('u1', 'c1', 'hello');
    expect(() => r.release()).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(r.isSettled).toBe(true);
  });
});
