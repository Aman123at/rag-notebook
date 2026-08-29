import { type SourceStreamEvent } from '@/contract/index.js';

type SourceStreamListener = (event: SourceStreamEvent) => void;
type ChannelKey = string;

const listeners = new Map<ChannelKey, Set<SourceStreamListener>>();

function channelKey(userId: string, workspaceId: string): ChannelKey {
  return `${userId}:${workspaceId}`;
}

export function subscribeToSourceEvents(
  userId: string,
  workspaceId: string,
  handler: SourceStreamListener,
): () => void {
  const key = channelKey(userId, workspaceId);
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(handler);
  return () => {
    const s = listeners.get(key);
    if (!s) return;
    s.delete(handler);
    if (s.size === 0) listeners.delete(key);
  };
}

export function publishSourceEvent(
  userId: string,
  workspaceId: string,
  event: SourceStreamEvent,
): void {
  const set = listeners.get(channelKey(userId, workspaceId));
  if (!set) return;
  for (const handler of set) {
    try {
      handler(event);
    } catch {
      // Ignore errors
    }
  }
}

export function _subscriberCountForTest(userId: string, workspaceId: string): number {
  return listeners.get(channelKey(userId, workspaceId))?.size ?? 0;
}

export function encodeSourceStreamSSE(event: SourceStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}
