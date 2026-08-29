import { type DefinedRoute, defineRoute, defineSseRoute } from '@/http/defineRoute.js';
import { attachPaginationMeta, buildMeta, resolvePagination } from '@/http/pagination.js';
import { expressSseTransport } from '@/http/sse-transport.js';
import { runChatTurn, SseStream } from '@/services/chat/index.js';
import {
  createChat,
  deleteChat,
  getChat,
  listChats,
  listMessages,
  updateChat,
} from '@/services/chats.service.js';

const list: DefinedRoute = defineRoute('chats.list', async (ctx) => {
  const window = resolvePagination(ctx.query);
  const { items, total } = await listChats(ctx.auth.userId, ctx.params.workspaceId, {
    limit: window.limit,
    offset: window.offset,
  });
  attachPaginationMeta(ctx.res, buildMeta(window, total));
  return items;
});

const create: DefinedRoute = defineRoute('chats.create', async (ctx) => {
  return createChat(ctx.auth.userId, ctx.params.workspaceId, ctx.body);
});

const get: DefinedRoute = defineRoute('chats.get', async (ctx) => {
  return getChat(ctx.auth.userId, ctx.params.chatId);
});

const update: DefinedRoute = defineRoute('chats.update', async (ctx) => {
  return updateChat(ctx.auth.userId, ctx.params.chatId, ctx.body);
});

const remove: DefinedRoute = defineRoute('chats.delete', async (ctx) => {
  return deleteChat(ctx.auth.userId, ctx.params.chatId);
});

const messages: DefinedRoute = defineRoute('chats.messages', async (ctx) => {
  return listMessages(ctx.auth.userId, ctx.params.chatId);
});

const sendMessage: DefinedRoute = defineSseRoute('chats.sendMessage', async (ctx) => {
  const sse = new SseStream(expressSseTransport(ctx.res));
  await runChatTurn(
    {
      userId: ctx.auth.userId,
      chatId: ctx.params.chatId,
      content: ctx.body.content,
      webSearch: ctx.body.webSearch ?? false,
      model: ctx.body.model,
    },
    sse,
  );
});

export const chatsRealRoutes: readonly DefinedRoute[] = [
  list,
  create,
  get,
  update,
  remove,
  messages,
  sendMessage,
];
