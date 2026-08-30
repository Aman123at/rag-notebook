import { type RouteKey } from '@/contract/index.js';
import { type RateLimitClass } from '@/http/middleware/rateLimit.js';

export const BODY_MAX_BYTES: Readonly<Record<RateLimitClass, number>> = Object.freeze({
  chat: 128 * 1024,
  write: 64 * 1024,
  read: 4 * 1024,
  uploadIntent: 4 * 1024,
  coupon: 1024,
  webhook: 512 * 1024,
});

export const ROUTE_CLASS: Readonly<Record<RouteKey, RateLimitClass>> = Object.freeze({
  'identity.me': 'read',
  'identity.updateMe': 'write',
  'identity.clerkWebhook': 'webhook',

  'workspaces.list': 'read',
  'workspaces.create': 'write',
  'workspaces.get': 'read',
  'workspaces.update': 'write',
  'workspaces.delete': 'write',

  'sources.uploadIntent': 'uploadIntent',
  'sources.create': 'write',
  'sources.list': 'read',
  'sources.get': 'read',
  'sources.status': 'read',
  'sources.retry': 'write',
  'sources.delete': 'write',
  'sources.download': 'read',
  'sources.preview': 'read',
  'sources.statusStream': 'read',

  'chats.list': 'read',
  'chats.create': 'write',
  'chats.get': 'read',
  'chats.update': 'write',
  'chats.delete': 'write',
  'chats.messages': 'read',
  'chats.sendMessage': 'chat',

  'messages.reaction': 'write',

  'memories.list': 'read',
  'memories.create': 'write',
  'memories.update': 'write',
  'memories.delete': 'write',

  'billing.plans': 'read',
  'billing.redeemCoupon': 'coupon',
  'billing.checkout': 'write',
  'billing.razorpayWebhook': 'webhook',

  'artifacts.list': 'read',
  'artifacts.create': 'write',
  'artifacts.get': 'read',

  'podcasts.get': 'read',
  'podcasts.create': 'write',
  'podcasts.delete': 'write',

  'ops.healthz': 'read',
  'ops.readyz': 'read',
  'ops.contract': 'read',
  'ops.usage': 'read',
});
