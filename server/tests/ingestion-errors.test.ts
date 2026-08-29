process.env['NODE_ENV'] = 'test';
process.env['APP_URL'] = 'http://localhost:3000';
process.env['CLIENT_ORIGINS'] = 'http://localhost:5173';
process.env['DATABASE_URL'] = 'postgres://postgres:postgres@localhost:5432/rag_notebook';
process.env['INNGEST_DEV'] = '1';

import { NonRetriableError } from 'inngest';
import { describe, expect, it } from 'vitest';

import {
  coerceIngestionFailure,
  IngestionError,
  isRetryable,
  throwIngestionError,
} from '@/inngest/errors.js';

describe('IngestionError taxonomy', () => {
  it('marks network/upstream codes as retryable', () => {
    expect(isRetryable('NETWORK_ERROR')).toBe(true);
    expect(isRetryable('UPSTREAM_5XX')).toBe(true);
    expect(isRetryable('RATE_LIMITED')).toBe(true);
  });

  it('marks parse/permission codes as terminal', () => {
    expect(isRetryable('PDF_ENCRYPTED')).toBe(false);
    expect(isRetryable('PDF_NO_TEXT_LAYER')).toBe(false);
    expect(isRetryable('UNSUPPORTED_CONTENT')).toBe(false);
    expect(isRetryable('PARSE_FAILURE')).toBe(false);
    expect(isRetryable('TRANSCRIPT_DISABLED')).toBe(false);
    expect(isRetryable('ROBOTS_BLOCKED')).toBe(false);
  });
});

describe('throwIngestionError', () => {
  it('wraps terminal codes in NonRetriableError', () => {
    try {
      throwIngestionError('PDF_ENCRYPTED', 'encrypted PDF');
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(NonRetriableError);
      expect((e as NonRetriableError).cause).toBeInstanceOf(IngestionError);
    }
  });

  it('throws a plain IngestionError for retryable codes', () => {
    try {
      throwIngestionError('UPSTREAM_5XX', 'boom');
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(IngestionError);
      expect(e).not.toBeInstanceOf(NonRetriableError);
    }
  });
});

describe('coerceIngestionFailure', () => {
  it('reads code/message off a direct IngestionError', () => {
    const err = new IngestionError('RATE_LIMITED', 'slow down');
    expect(coerceIngestionFailure(err)).toEqual({
      code: 'RATE_LIMITED',
      message: 'slow down',
      retryable: true,
    });
  });

  it('walks the cause chain for a NonRetriableError-wrapped terminal', () => {
    let caught: unknown;
    try {
      throwIngestionError('PDF_NO_TEXT_LAYER', 'no OCR');
    } catch (e) {
      caught = e;
    }
    expect(coerceIngestionFailure(caught)).toEqual({
      code: 'PDF_NO_TEXT_LAYER',
      message: 'no OCR',
      retryable: false,
    });
  });

  it('falls back to INTERNAL_ERROR non-retryable for opaque errors', () => {
    const failure = coerceIngestionFailure(new Error('who knows'));
    expect(failure.code).toBe('INTERNAL_ERROR');
    expect(failure.retryable).toBe(false);
    expect(failure.message).toBe('who knows');
  });
});
