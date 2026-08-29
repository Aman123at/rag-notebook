# Contract changelog

## v1.3.0 — 2026-08-27

Additive (minor). No existing shape changed; v1.2.0 clients keep working
untouched and simply never see the new event.

### Web-search offer / consent flow

- **New SSE event `web_search_offer`** on `chats.sendMessage`:
  `{ query: string; remainingSearches: number }`. Emitted when retrieval
  found nothing in the workspace corpus and the assistant is asking
  permission to search the public web instead. It arrives alongside the
  answer text (which streams as normal `token` events) and is the
  machine-readable half, so a client can render an explicit
  confirm/decline control rather than relying on the user typing "yes".
  It is mutually exclusive with `tool_call` within one turn.

  To accept, re-send the request with `webSearch: true` (any affirmative
  free-text reply such as "yes" also works). To decline, send anything
  else — the offer expires as soon as the next user message lands.

- **`tool_call.data.remainingSearches?: number`** (optional, additive) —
  web searches left in the chat session after the one just reported.

- **`limits.json` gains `tunables.webSearch`**:
  `{ MAX_PER_CHAT: 5, MAX_RESULTS: 5 }`. Web search is a fallback for
  questions the corpus cannot answer, not a general search engine, so it
  is capped at five executed searches per chat session. Offers and
  declined offers do not count.

### Documentation fix (no behaviour change)

- `sse-events.d.ts` declared `retrieval.data.status` as
  `'started' | 'completed'`. The server has emitted `'failed'` since
  v1.0.0, where the enum was widened; the hand-maintained `.d.ts`
  template was not updated at the time. The type now matches what the
  server has been sending. `openapi.json` was always correct.

