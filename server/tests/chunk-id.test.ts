import { describe, expect, it } from 'vitest';

import { CHUNK_ID_NAMESPACE, chunkId } from '../src/db/chunk-id.js';

describe('chunkId', () => {
  const sourceA = '11111111-1111-4111-8111-111111111111';
  const sourceB = '22222222-2222-4222-8222-222222222222';

  it('is stable across calls for the same input', () => {
    const a = chunkId(sourceA, 0);
    const b = chunkId(sourceA, 0);
    expect(a).toBe(b);
  });

  it('varies by chunk index', () => {
    const a = chunkId(sourceA, 0);
    const b = chunkId(sourceA, 1);
    expect(a).not.toBe(b);
  });

  it('varies by source id', () => {
    const a = chunkId(sourceA, 5);
    const b = chunkId(sourceB, 5);
    expect(a).not.toBe(b);
  });

  it('produces a valid v5 uuid (version 5, RFC 4122 variant)', () => {
    const id = chunkId(sourceA, 42);

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    expect(id.charAt(14)).toBe('5');

    expect(['8', '9', 'a', 'b']).toContain(id.charAt(19));
  });

  it('rejects a non-integer chunk index', () => {
    expect(() => chunkId(sourceA, 1.5)).toThrow();
    expect(() => chunkId(sourceA, -1)).toThrow();
  });

  it('the namespace uuid is documented in the module and stable', () => {
    expect(CHUNK_ID_NAMESPACE).toBe('2f7c5f4a-4b8e-4a2f-9e77-1e9a2b0a1c11');
  });
});
