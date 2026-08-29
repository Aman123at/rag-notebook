import { type DefinedRoute, defineRoute } from '@/http/defineRoute.js';
import { setMessageReaction } from '@/services/chats.service.js';

const reaction: DefinedRoute = defineRoute('messages.reaction', async (ctx) =>
  setMessageReaction(ctx.auth.userId, ctx.params.messageId, ctx.body),
);

export const messagesRealRoutes: readonly DefinedRoute[] = [reaction];
