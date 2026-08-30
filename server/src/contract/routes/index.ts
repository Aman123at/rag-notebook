import { type RouteDefinition } from '../common/route.js';

import { artifactsRoutes } from './artifacts.js';
import { billingRoutes } from './billing.js';
import { chatsRoutes } from './chats.js';
import { identityRoutes } from './identity.js';
import { memoriesRoutes } from './memories.js';
import { messagesRoutes } from './messages.js';
import { opsRoutes } from './ops.js';
import { podcastsRoutes } from './podcasts.js';
import { sourcesRoutes } from './sources.js';
import { workspacesRoutes } from './workspaces.js';










export const routeRegistry = {
  ...identityRoutes,
  ...workspacesRoutes,
  ...sourcesRoutes,
  ...chatsRoutes,
  ...messagesRoutes,
  ...memoriesRoutes,
  ...billingRoutes,
  ...artifactsRoutes,
  ...podcastsRoutes,
  ...opsRoutes,
} as const satisfies Record<string, RouteDefinition>;

export type RouteRegistry = typeof routeRegistry;
export type RouteKey = keyof RouteRegistry;


export const ROUTE_KEYS: readonly RouteKey[] = Object.freeze(
  Object.keys(routeRegistry) as RouteKey[],
);
