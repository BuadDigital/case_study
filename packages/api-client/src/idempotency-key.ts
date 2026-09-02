const IDEMPOTENCY_HEADER = "Idempotency-Key";

/** RFC 4122 v4 — one key per user intent (click/submit). */
export function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Attach a stable idempotency key to a mutating request. Generates one when omitted. */
export function withIdempotencyKey(
  headers: HeadersInit,
  key: string = createIdempotencyKey(),
): HeadersInit {
  const next = new Headers(headers);
  next.set(IDEMPOTENCY_HEADER, key);
  return next;
}

export { IDEMPOTENCY_HEADER };
