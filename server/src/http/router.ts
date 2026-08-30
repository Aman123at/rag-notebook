import express, { type RequestHandler, type Router } from 'express';

import { ROUTE_KEYS, type RouteKey, routeRegistry } from '@/contract/index.js';
import { type DefinedRoute } from '@/http/defineRoute.js';
import { requireAuth } from '@/http/middleware/auth.js';
import { bodySizeLimit } from '@/http/middleware/bodySize.js';
import { pendingHandler } from '@/http/pending.js';
import { BODY_MAX_BYTES, ROUTE_CLASS } from '@/http/route-classes.js';

const PENDING_PHASE: Readonly<Record<RouteKey, string>> = Object.freeze({
  'identity.me': '',
  'identity.updateMe': '',
  'identity.clerkWebhook': '',
  'workspaces.list': '',
  'workspaces.create': '',
  'workspaces.get': '',
  'workspaces.update': '',
  'workspaces.delete': '',
  'sources.uploadIntent': '',
  'sources.create': '',
  'sources.list': '',
  'sources.get': '',
  'sources.status': '',
  'sources.retry': '',
  'sources.delete': '',
  'sources.download': '',
  'sources.preview': '',
  'sources.statusStream': '',
  'chats.list': '',
  'chats.create': '',
  'chats.get': '',
  'chats.update': '',
  'chats.delete': '',
  'chats.messages': '',
  'chats.sendMessage': '',
  'messages.reaction': '',
  'memories.list': '',
  'memories.create': '',
  'memories.update': '',
  'memories.delete': '',
  'billing.plans': '',
  'billing.redeemCoupon': '',
  'billing.checkout': '',
  'billing.razorpayWebhook': '',
  'artifacts.list': '',
  'artifacts.create': '',
  'artifacts.get': '',
  'podcasts.get': '',
  'podcasts.create': '',
  'podcasts.delete': '',
  'ops.usage': '',
  'ops.healthz': '',
  'ops.readyz': '',
  'ops.contract': '',
});

const MOUNTED = new Set<RouteKey>();

export const MOUNTED_ROUTE_KEYS: ReadonlySet<RouteKey> = MOUNTED;

export const PENDING_ROUTE_KEYS: ReadonlySet<RouteKey> = new Set(
  ROUTE_KEYS.filter((k) => PENDING_PHASE[k] !== ''),
);

function methodToExpress(m: string): 'get' | 'post' | 'patch' | 'put' | 'delete' {
  const lower = m.toLowerCase();
  if (
    lower === 'get' ||
    lower === 'post' ||
    lower === 'patch' ||
    lower === 'put' ||
    lower === 'delete'
  ) {
    return lower;
  }
  throw new Error(`Unsupported HTTP method in registry: ${m}`);
}

function toExpressPath(p: string): string {
  return p;
}

export function buildAppRouter(realRoutes: readonly DefinedRoute[]): Router {
  const router: Router = express.Router();
  const explicit = new Set<RouteKey>();

  const authGate: RequestHandler = requireAuth();

  for (const key of ROUTE_KEYS) {
    if (!(key in ROUTE_CLASS)) {
      throw new Error(
        `Route ${key} has no entry in ROUTE_CLASS. Every registry key must be classified for rate limiting.`,
      );
    }
  }

  for (const bundle of realRoutes) {
    if (explicit.has(bundle.key)) {
      throw new Error(`Route ${bundle.key} was mounted twice.`);
    }
    explicit.add(bundle.key);
    MOUNTED.add(bundle.key);
    const method = methodToExpress(bundle.def.method);
    const cls = ROUTE_CLASS[bundle.key];

    const chain: RequestHandler[] = [];
    if (bundle.def.auth === 'required') chain.push(authGate);

    chain.push(bodySizeLimit(BODY_MAX_BYTES[cls]));
    chain.push(bundle.handler);
    router[method](toExpressPath(bundle.def.path), ...chain);
  }

  for (const key of ROUTE_KEYS) {
    if (explicit.has(key)) continue;
    const phase = PENDING_PHASE[key];
    if (phase === '') {
      throw new Error(
        `Route ${key} is marked non-pending in PENDING_PHASE but no real handler was supplied.`,
      );
    }
    const def = routeRegistry[key];
    const method = methodToExpress(def.method);
    router[method](toExpressPath(def.path), pendingHandler(key, phase));
  }

  const wired = new Set<RouteKey>([...explicit, ...PENDING_ROUTE_KEYS]);
  if (wired.size !== ROUTE_KEYS.length) {
    const missing = ROUTE_KEYS.filter((k) => !wired.has(k));
    throw new Error(`Router did not mount every registry key. Missing: ${missing.join(', ')}`);
  }

  return router;
}
