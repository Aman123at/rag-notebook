import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';

import { env } from '@/config/env.js';
import { logger } from '@/observability/logger.js';

let sdkHandle: NodeSDK | null = null;
let processorHandle: LangfuseSpanProcessor | null = null;
let started = false;

export function initTracing(): boolean {
  if (started) return sdkHandle !== null;
  started = true;

  if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY) {
    logger.warn(
      { event: 'tracing.disabled' },
      'LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY not configured — tracing disabled',
    );
    return false;
  }

  processorHandle = new LangfuseSpanProcessor({
    publicKey: env.LANGFUSE_PUBLIC_KEY,
    secretKey: env.LANGFUSE_SECRET_KEY,
    baseUrl: env.LANGFUSE_BASE_URL,
    environment: env.NODE_ENV,
    exportMode: 'batched',
  });

  sdkHandle = new NodeSDK({
    spanProcessors: [processorHandle],
  });

  try {
    sdkHandle.start();
    logger.info(
      { event: 'tracing.enabled', baseUrl: env.LANGFUSE_BASE_URL },
      'Langfuse tracing enabled',
    );
    return true;
  } catch (err) {
    logger.error(
      { event: 'tracing.start_failed', err: err instanceof Error ? err.message : String(err) },
      'Langfuse tracing failed to start — continuing without observability',
    );
    sdkHandle = null;
    processorHandle = null;
    return false;
  }
}

export async function shutdownTracing(): Promise<void> {
  if (!sdkHandle) return;
  try {
    if (processorHandle) await processorHandle.forceFlush();
    await sdkHandle.shutdown();
  } catch (err) {
    logger.warn(
      { event: 'tracing.shutdown_failed', err: err instanceof Error ? err.message : String(err) },
      'Langfuse tracing shutdown failed — spans may be lost',
    );
  } finally {
    sdkHandle = null;
    processorHandle = null;
  }
}

export function isTracingEnabled(): boolean {
  return sdkHandle !== null;
}
