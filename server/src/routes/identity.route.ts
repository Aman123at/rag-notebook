import { type DefinedRoute, defineRoute } from '@/http/defineRoute.js';
import { updateMe as applyPatch, getMe } from '@/services/users.service.js';

const me: DefinedRoute = defineRoute('identity.me', async (ctx) => getMe(ctx.auth.userId));

const updateMe: DefinedRoute = defineRoute('identity.updateMe', async (ctx) =>
  applyPatch(ctx.auth.userId, ctx.body),
);

export const identityRealRoutes: readonly DefinedRoute[] = [me, updateMe];
