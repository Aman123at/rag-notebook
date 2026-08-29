import { MemoryClient } from 'mem0ai';

import { env } from '@/config/env.js';
import { logger } from '@/observability/logger.js';

import { withTimeout } from './runtime.js';

const MEM0_TIMEOUT_MS = 4_000;

const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 60_000;

export const MEM0_SEARCH_TOP_K = 8;

export const MEM0_SCOPE_OVERFETCH = 4;

export const WORKSPACE_METADATA_KEY = 'workspaceId';

export function isRecallableInWorkspace(metadata: unknown, workspaceId: string): boolean {
  if (metadata === null || typeof metadata !== 'object') return true;
  const scope = (metadata as Record<string, unknown>)[WORKSPACE_METADATA_KEY];
  if (typeof scope !== 'string' || scope.length === 0) return true;
  return scope === workspaceId;
}

let clientHandle: MemoryClient | undefined;

interface CircuitState {
  consecutiveFailures: number;
  openedAt: number | null;
}
const circuit: CircuitState = { consecutiveFailures: 0, openedAt: null };

function circuitOpen(): boolean {
  if (circuit.openedAt === null) return false;
  const elapsed = Date.now() - circuit.openedAt;
  if (elapsed >= CIRCUIT_COOLDOWN_MS) {
    circuit.openedAt = null;
    circuit.consecutiveFailures = CIRCUIT_FAILURE_THRESHOLD - 1;
    return false;
  }
  return true;
}

function recordSuccess(): void {
  circuit.consecutiveFailures = 0;
  circuit.openedAt = null;
}

function recordFailure(): void {
  circuit.consecutiveFailures += 1;
  if (circuit.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
    circuit.openedAt = Date.now();
    logger.warn(
      {
        event: 'mem0.circuit.open',
        failures: circuit.consecutiveFailures,
        cooldownMs: CIRCUIT_COOLDOWN_MS,
      },
      'Mem0 circuit breaker opened — suppressing calls until cooldown',
    );
  }
}

function getClient(): MemoryClient | null {
  if (clientHandle) return clientHandle;
  if (!env.MEM0_API_KEY) return null;
  clientHandle = new MemoryClient({ apiKey: env.MEM0_API_KEY });
  return clientHandle;
}

export async function searchMemories(
  userId: string,
  query: string,
  workspaceId: string,
): Promise<readonly string[]> {
  const client = getClient();
  if (!client) return [];
  if (circuitOpen()) return [];

  try {
    const { results } = await withTimeout('mem0.search', MEM0_TIMEOUT_MS, () =>
      client.search(query, {
        filters: { user_id: userId },
        topK: MEM0_SEARCH_TOP_K * MEM0_SCOPE_OVERFETCH,
      }),
    );
    recordSuccess();
    const out: string[] = [];
    for (const m of results) {
      const text = m.memory;
      if (typeof text !== 'string' || text.trim().length === 0) continue;
      if (!isRecallableInWorkspace(m.metadata, workspaceId)) continue;
      out.push(text.trim());
      if (out.length >= MEM0_SEARCH_TOP_K) break;
    }
    return out;
  } catch (err) {
    recordFailure();
    logger.warn(
      {
        event: 'mem0.search.failed',
        userId,
        err: err instanceof Error ? err.message : String(err),
      },
      'Mem0 search failed — returning empty memory list',
    );
    return [];
  }
}

export async function extractMemories(
  userId: string,
  chatId: string,
  exchange: { userContent: string; assistantContent: string },
  workspaceId: string,
): Promise<void> {
  const client = getClient();
  if (!client) return;
  if (circuitOpen()) return;

  try {
    await withTimeout('mem0.add', MEM0_TIMEOUT_MS, () =>
      client.add(
        [
          { role: 'user', content: exchange.userContent },
          { role: 'assistant', content: exchange.assistantContent },
        ],

        { userId, runId: chatId, metadata: { [WORKSPACE_METADATA_KEY]: workspaceId } },
      ),
    );
    recordSuccess();
  } catch (err) {
    recordFailure();
    logger.warn(
      {
        event: 'mem0.add.failed',
        userId,
        chatId,
        err: err instanceof Error ? err.message : String(err),
      },
      'Mem0 add failed — memory not persisted (turn was still served)',
    );
  }
}

export class MemoryStoreUnavailableError extends Error {
  constructor() {
    super('Mem0 is not configured — MEMORY endpoints are unavailable.');
    this.name = 'MemoryStoreUnavailableError';
  }
}

export interface MemoryRecord {
  id: string;
  content: string;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

function toRecord(m: {
  id: string;
  memory?: string;
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}): MemoryRecord {
  const nowIso = new Date().toISOString();
  return {
    id: m.id,
    content: typeof m.memory === 'string' ? m.memory : '',
    userId: typeof m.userId === 'string' ? m.userId : null,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : nowIso,
    updatedAt: m.updatedAt instanceof Date ? m.updatedAt.toISOString() : nowIso,
  };
}

export async function listMemoriesForUser(userId: string): Promise<MemoryRecord[]> {
  const client = getClient();
  if (!client) throw new MemoryStoreUnavailableError();
  const page = await withTimeout('mem0.getAll', MEM0_TIMEOUT_MS, () =>
    client.getAll({ filters: { user_id: userId }, pageSize: 100 }),
  );
  return page.results.map(toRecord);
}

export async function createMemoryForUser(userId: string, content: string): Promise<MemoryRecord> {
  const client = getClient();
  if (!client) throw new MemoryStoreUnavailableError();
  const results = await withTimeout('mem0.add', MEM0_TIMEOUT_MS, () =>
    client.add([{ role: 'user', content }], { userId }),
  );
  const first = results[0];
  if (!first || typeof first.id !== 'string' || first.id.length === 0) {
    throw new Error('Mem0 add returned no memory row — nothing persisted.');
  }
  return toRecord(first);
}

export async function findMemoryForUser(
  userId: string,
  memoryId: string,
): Promise<MemoryRecord | null> {
  const client = getClient();
  if (!client) throw new MemoryStoreUnavailableError();
  try {
    const memory = await withTimeout('mem0.get', MEM0_TIMEOUT_MS, () => client.get(memoryId));
    const record = toRecord(memory);
    if (record.userId !== null && record.userId !== userId) return null;
    return record;
  } catch (err) {
    logger.debug(
      {
        event: 'mem0.get.notfound',
        memoryId,
        err: err instanceof Error ? err.message : String(err),
      },
      'Mem0 get returned no record',
    );
    return null;
  }
}

export async function updateMemoryForUser(
  userId: string,
  memoryId: string,
  content: string,
): Promise<MemoryRecord> {
  const client = getClient();
  if (!client) throw new MemoryStoreUnavailableError();
  await withTimeout('mem0.update', MEM0_TIMEOUT_MS, () =>
    client.update(memoryId, { text: content }),
  );

  const refreshed = await findMemoryForUser(userId, memoryId);
  if (refreshed) return refreshed;
  const nowIso = new Date().toISOString();
  return {
    id: memoryId,
    content,
    userId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export async function deleteMemoryById(memoryId: string): Promise<void> {
  const client = getClient();
  if (!client) throw new MemoryStoreUnavailableError();
  await withTimeout('mem0.delete', MEM0_TIMEOUT_MS, () => client.delete(memoryId));
}

export function neverThrow(fn: () => Promise<void>): void {
  void fn().catch((err: unknown) => {
    logger.warn(
      { event: 'mem0.background.failed', err: err instanceof Error ? err.message : String(err) },
      'Mem0 background task failed (swallowed)',
    );
  });
}
