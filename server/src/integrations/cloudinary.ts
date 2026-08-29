import { v2 as cloudinary } from 'cloudinary';
import { NonRetriableError } from 'inngest';

import { env } from '@/config/env.js';
import { IngestionError, throwIngestionError } from '@/inngest/errors.js';

import { withRetry } from './runtime.js';

const SIGNATURE_TTL_SECONDS = 600;

export interface UploadEnvelope {
  uploadUrl: string;
  publicId: string;
  timestamp: number;
  signature: string;
  apiKey: string;
  resourceType: 'raw';

  expiresAt: string;
}

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary env vars missing; upload endpoints unavailable.');
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

export function buildUploadSignature(publicId: string): UploadEnvelope {
  ensureConfigured();
  const timestamp = Math.floor(Date.now() / 1000);

  const paramsToSign: Record<string, string | number> = {
    public_id: publicId,
    timestamp,
    type: 'authenticated',
  };
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,

    env.CLOUDINARY_API_SECRET as string,
  );
  const uploadUrl = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/raw/upload`;
  return {
    uploadUrl,
    publicId,
    timestamp,
    signature,
    apiKey: env.CLOUDINARY_API_KEY as string,
    resourceType: 'raw',
    expiresAt: new Date((timestamp + SIGNATURE_TTL_SECONDS) * 1000).toISOString(),
  };
}

export interface SignedDownload {
  url: string;
  expiresAt: string;
}
export function buildSignedDownloadUrl(publicId: string, ttlSeconds = 300): SignedDownload {
  ensureConfigured();
  const expiresAtEpoch = Math.floor(Date.now() / 1000) + ttlSeconds;
  const url = cloudinary.utils.private_download_url(publicId, '', {
    resource_type: 'raw',
    type: 'authenticated',
    expires_at: expiresAtEpoch,
    attachment: true,
  });
  return { url, expiresAt: new Date(expiresAtEpoch * 1000).toISOString() };
}

export interface CloudinaryAsset {
  publicId: string;
  bytes: number;
  format: string | null;
  resourceType: string;
  type: string;
}
export async function fetchAssetMetadata(publicId: string): Promise<CloudinaryAsset | null> {
  ensureConfigured();
  try {
    const res = (await cloudinary.api.resource(publicId, {
      resource_type: 'raw',
      type: 'authenticated',
    })) as {
      public_id: string;
      bytes: number;
      format?: string;
      resource_type: string;
      type: string;
    };
    return {
      publicId: res.public_id,
      bytes: res.bytes,
      format: res.format ?? null,
      resourceType: res.resource_type,
      type: res.type,
    };
  } catch (err) {
    const httpCode = (err as { error?: { http_code?: number } })?.error?.http_code;
    if (httpCode === 404) return null;
    throw err;
  }
}

export async function destroyRawAsset(publicId: string): Promise<void> {
  ensureConfigured();
  const res = (await cloudinary.uploader.destroy(publicId, {
    resource_type: 'raw',
    type: 'authenticated',
    invalidate: true,
  })) as { result?: string };
  const result = res?.result;
  if (result === 'ok' || result === 'not found') return;
  throw new Error(`cloudinary.uploader.destroy(${publicId}) returned ${result ?? 'unknown'}`);
}

const MAX_DOWNLOAD_BYTES = 128 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 60_000;

const RETRY_BASE_MS = 200;
const RETRY_JITTER_RATIO = 1.5;

export async function downloadAssetBytes(
  publicId: string,
  opts?: { maxBytes?: number },
): Promise<Uint8Array> {
  ensureConfigured();
  const maxBytes = Math.min(opts?.maxBytes ?? MAX_DOWNLOAD_BYTES, MAX_DOWNLOAD_BYTES);
  return withRetry(() => fetchSignedAsset(publicId, maxBytes), {
    label: 'cloudinary.download',
    maxAttempts: 2,
    baseMs: RETRY_BASE_MS,
    factor: 1,
    jitterRatio: RETRY_JITTER_RATIO,

    isRetryable: (err) => err instanceof IngestionError && err.failureRetryable,
  });
}

async function fetchSignedAsset(publicId: string, maxBytes: number): Promise<Uint8Array> {
  const { url } = buildSignedDownloadUrl(publicId);
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throwIngestionError(
      'NETWORK_ERROR',
      `Cloudinary download failed for ${publicId}: ${message}.`,
      { cause: err },
    );
  }
  if (!response.ok) {
    throwDownloadStatusError(response.status, publicId);
  }
  const declared = Number(response.headers.get('content-length') ?? Number.NaN);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throwIngestionError(
      'CONTENT_TOO_LARGE',
      `Asset ${publicId} is ${declared} bytes; the ingestion ceiling is ${maxBytes}.`,
    );
  }
  return readCapped(response, publicId, maxBytes);
}

function throwDownloadStatusError(status: number, publicId: string): never {
  if (status === 429) {
    throwIngestionError('RATE_LIMITED', `Cloudinary rate-limited download of ${publicId}.`);
  }
  if (status >= 500) {
    throwIngestionError('UPSTREAM_5XX', `Cloudinary ${status} downloading ${publicId}.`);
  }
  if (status === 401 || status === 403) {
    throwIngestionError(
      'PERMISSION_DENIED',
      `Cloudinary rejected the signed download URL for ${publicId} (${status}).`,
    );
  }
  throwIngestionError('EXTRACTION_FAILED', `Cloudinary ${status} downloading ${publicId}.`);
}

async function readCapped(
  response: Response,
  publicId: string,
  maxBytes: number,
): Promise<Uint8Array> {
  const body = response.body;
  if (!body) {
    throwIngestionError('EXTRACTION_FAILED', `Cloudinary returned an empty body for ${publicId}.`);
  }

  const reader: ReadableStreamDefaultReader<Uint8Array> = body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throwIngestionError(
          'CONTENT_TOO_LARGE',
          `Asset ${publicId} exceeds the ${maxBytes}-byte ingestion ceiling.`,
        );
      }
      parts.push(value);
    }
  } catch (err) {
    if (err instanceof IngestionError || err instanceof NonRetriableError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throwIngestionError(
      'NETWORK_ERROR',
      `Cloudinary download of ${publicId} was interrupted: ${message}.`,
      { cause: err },
    );
  }
  if (total === 0) {
    throwIngestionError('PARSE_FAILURE', `Asset ${publicId} is empty (0 bytes).`);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}
