import type { paths } from "@/contract/types";
import { env } from "@/lib/env";
import type { GetToken } from "@/types/api.types";
import { isAbort } from "./abort";
import { readFrames, sseRequestInit } from "./sse";

type StatusStreamFrame =
  paths["/workspaces/{workspaceId}/sources/events"]["get"]["responses"][200]["content"]["text/event-stream"];

export type SourceStatusEvent = Extract<StatusStreamFrame, { type: "source_status" }>["data"];

export type StreamState = "open" | "lost";

export interface SourceStatusSubscriber {
  workspaceId: string;
  getToken: GetToken;
  onEvent: (event: SourceStatusEvent) => void;
  onStateChange: (state: StreamState) => void;
}

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

interface Channel {
  subscribers: Set<SourceStatusSubscriber>;
  controller: AbortController;
  closed: boolean;
  state: StreamState | null;
  wake: (() => void) | null;
  timer: ReturnType<typeof setTimeout> | null;
}

const channels = new Map<string, Channel>();

export function subscribeToSourceStatus(subscriber: SourceStatusSubscriber): () => void {
  const { workspaceId } = subscriber;
  const existing = channels.get(workspaceId);
  const channel: Channel = existing ?? {
    subscribers: new Set(),
    controller: new AbortController(),
    closed: false,
    state: null,
    wake: null,
    timer: null,
  };
  if (existing === undefined) channels.set(workspaceId, channel);
  channel.subscribers.add(subscriber);
  if (channel.state !== null) subscriber.onStateChange(channel.state);
  if (existing === undefined) void run(workspaceId, channel);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    channel.subscribers.delete(subscriber);
    if (channel.subscribers.size > 0) return;
    channel.closed = true;
    channel.controller.abort();
    if (channel.timer !== null) clearTimeout(channel.timer);
    channel.wake?.();
    if (channels.get(workspaceId) === channel) channels.delete(workspaceId);
  };
}

async function run(workspaceId: string, channel: Channel): Promise<void> {
  let backoffMs = INITIAL_BACKOFF_MS;

  while (!channel.closed) {
    const body = await openStream(workspaceId, channel);
    if (channel.closed) {
      if (body !== null) void body.cancel().catch(() => {});
      return;
    }

    if (body !== null) {
      backoffMs = INITIAL_BACKOFF_MS;
      broadcastState(channel, "open");
      try {
        for await (const frame of readFrames(body)) {
          if (frame.type === "source_status" && isSourceStatusEvent(frame.data)) {
            deliver(channel, frame.data);
          }
        }
      } catch (cause) {
        if (isAbort(cause)) return;
      }
      if (channel.closed) return;
    }

    broadcastState(channel, "lost");
    await wait(channel, Math.min(backoffMs, MAX_BACKOFF_MS));
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
  }
}

async function openStream(
  workspaceId: string,
  channel: Channel,
): Promise<ReadableStream<Uint8Array> | null> {
  const getToken = currentGetToken(channel);
  if (getToken === null) return null;
  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_API_URL}/workspaces/${workspaceId}/sources/events`,
      {
        ...sseRequestInit(await getToken()),
        method: "GET",
        signal: channel.controller.signal,
      },
    );
    if (!res.ok || res.body === null) return null;
    return res.body;
  } catch (cause) {
    if (isAbort(cause)) channel.closed = true;
    return null;
  }
}

function currentGetToken(channel: Channel): GetToken | null {
  for (const subscriber of channel.subscribers) return subscriber.getToken;
  return null;
}

function deliver(channel: Channel, event: SourceStatusEvent): void {
  for (const subscriber of channel.subscribers) {
    try {
      subscriber.onEvent(event);
    } catch (cause) {
      console.error("[source-status] a subscriber threw while handling an event", cause);
    }
  }
}

function broadcastState(channel: Channel, state: StreamState): void {
  if (channel.state === state) return;
  channel.state = state;
  for (const subscriber of channel.subscribers) subscriber.onStateChange(state);
}

function wait(channel: Channel, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const done = () => {
      channel.wake = null;
      channel.timer = null;
      resolve();
    };
    channel.wake = done;
    channel.timer = setTimeout(done, ms);
  });
}

function isSourceStatusEvent(value: unknown): value is SourceStatusEvent {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.sourceId === "string" &&
    typeof v.status === "string" &&
    typeof v.displayStatus === "string" &&
    typeof v.chunkCount === "number"
  );
}
