import { type DefinedRoute, defineRoute } from '@/http/defineRoute.js';
import { DEFAULT_USAGE_WINDOW_DAYS, getUsageSummary } from '@/services/usage.service.js';

const usage: DefinedRoute = defineRoute('ops.usage', async (ctx) =>
  getUsageSummary(ctx.auth.userId, ctx.query.days ?? DEFAULT_USAGE_WINDOW_DAYS),
);

export const observabilityRealRoutes: readonly DefinedRoute[] = [usage];
