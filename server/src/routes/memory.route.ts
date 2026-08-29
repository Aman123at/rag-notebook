import { AppError } from '@/errors/AppError.js';
import { type DefinedRoute, defineRoute } from '@/http/defineRoute.js';
import {
  createMemoryForUser,
  deleteMemoryById,
  findMemoryForUser,
  listMemoriesForUser,
  type MemoryRecord,
  MemoryStoreUnavailableError,
  updateMemoryForUser,
} from '@/integrations/mem0.js';

function toWire(m: MemoryRecord): {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: m.id,
    content: m.content,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

function translateStoreError(err: unknown): never {
  if (err instanceof MemoryStoreUnavailableError) {
    throw new AppError('INTERNAL_ERROR', err.message, { exposeDetails: false });
  }
  throw err;
}

const list: DefinedRoute = defineRoute('memories.list', async (ctx) => {
  try {
    const records = await listMemoriesForUser(ctx.auth.userId);
    return records.map(toWire);
  } catch (err) {
    translateStoreError(err);
  }
});

const create: DefinedRoute = defineRoute('memories.create', async (ctx) => {
  try {
    const record = await createMemoryForUser(ctx.auth.userId, ctx.body.content);
    return toWire(record);
  } catch (err) {
    translateStoreError(err);
  }
});

const update: DefinedRoute = defineRoute('memories.update', async (ctx) => {
  try {
    const existing = await findMemoryForUser(ctx.auth.userId, ctx.params.memoryId);
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Memory not found.', { exposeDetails: false });
    }
    const updated = await updateMemoryForUser(
      ctx.auth.userId,
      ctx.params.memoryId,
      ctx.body.content,
    );
    return toWire(updated);
  } catch (err) {
    translateStoreError(err);
  }
});

const remove: DefinedRoute = defineRoute('memories.delete', async (ctx) => {
  try {
    const existing = await findMemoryForUser(ctx.auth.userId, ctx.params.memoryId);
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Memory not found.', { exposeDetails: false });
    }
    await deleteMemoryById(ctx.params.memoryId);
    return { id: ctx.params.memoryId, deleted: true as const };
  } catch (err) {
    translateStoreError(err);
  }
});

export const memoryRealRoutes: readonly DefinedRoute[] = [list, create, update, remove];
