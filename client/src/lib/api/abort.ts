/**
 * Was this rejection the caller closing a stream, rather than something going
 * wrong? An aborted `fetch` or `reader.read()` rejects with a `DOMException`
 * named `AbortError`; every long-lived read path in this layer has to tell that
 * apart from a genuine network failure, and mistaking one for the other either
 * reports a phantom error to the user or hides a real one.
 */
export function isAbort(cause: unknown): boolean {
  return (cause as { name?: string } | null)?.name === "AbortError";
}
