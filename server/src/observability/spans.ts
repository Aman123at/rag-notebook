import { type Attributes, type Span, SpanStatusCode, trace } from '@opentelemetry/api';

const TRACER_NAME = 'rag-notebook-server';
const tracer = trace.getTracer(TRACER_NAME);

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Attributes,
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes: attributes ?? {} }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err instanceof Error ? err : new Error(String(err)));
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}

export function setSpanAttrs(attributes: Attributes): void {
  const span = trace.getActiveSpan();
  if (span) span.setAttributes(attributes);
}
