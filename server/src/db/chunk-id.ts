import { createHash } from 'node:crypto';

export const CHUNK_ID_NAMESPACE = '2f7c5f4a-4b8e-4a2f-9e77-1e9a2b0a1c11' as const;

const NAMESPACE_BYTES = uuidToBytes(CHUNK_ID_NAMESPACE);

export function chunkId(sourceId: string, chunkIndex: number): string {
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw new Error(`chunkIndex must be a non-negative integer, got ${chunkIndex}`);
  }
  const name = `${sourceId}:${chunkIndex}`;
  const hash = createHash('sha1')
    .update(NAMESPACE_BYTES)
    .update(Buffer.from(name, 'utf8'))
    .digest();
  const bytes = Buffer.alloc(16);
  hash.copy(bytes, 0, 0, 16);

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;

  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  return bytesToUuid(bytes);
}

function uuidToBytes(uuid: string): Buffer {
  const clean = uuid.replace(/-/g, '');
  if (clean.length !== 32) throw new Error(`Invalid UUID: ${uuid}`);
  return Buffer.from(clean, 'hex');
}

function bytesToUuid(bytes: Buffer): string {
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
