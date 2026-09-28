const IDEMPOTENCY_HEADER = "Idempotency-Key";

/** RFC 4122 v4 — one key per user intent (click/submit). */
export function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Flatten HeadersInit so spreading into a fetch init object keeps every header. */
export function headersToRecord(headers: HeadersInit): Record<string, string> {
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((value, name) => {
      out[name] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
}

export function mergeHeaderRecords(
  ...parts: Array<HeadersInit | undefined>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of parts) {
    if (!part) continue;
    Object.assign(out, headersToRecord(part));
  }
  return out;
}

/** Attach a stable idempotency key to a mutating request. Generates one when omitted. */
export function withIdempotencyKey(
  headers: HeadersInit,
  key: string = createIdempotencyKey(),
): Record<string, string> {
  const next = headersToRecord(headers);
  next[IDEMPOTENCY_HEADER] = key;
  return next;
}

export { IDEMPOTENCY_HEADER };
