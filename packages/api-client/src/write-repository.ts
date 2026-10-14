/**
 * The single interception point for every browser write to a backend API.
 *
 * Reads deliberately pass straight through. POST/PUT/PATCH/DELETE requests pass through the
 * configured interceptor, which lets the offline phase enqueue, retry, or reject a write without
 * teaching every feature about IndexedDB. With no interceptor installed it behaves exactly like
 * the native fetch function.
 */
export type ApiWriteMethod = "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiWriteRequest = {
  input: RequestInfo | URL;
  init?: RequestInit;
  method: ApiWriteMethod;
};

export type ApiWriteInterceptor = (
  request: ApiWriteRequest,
  next: () => Promise<Response>,
) => Promise<Response>;

let interceptor: ApiWriteInterceptor | null = null;

export function installApiWriteInterceptor(
  nextInterceptor: ApiWriteInterceptor,
): () => void {
  interceptor = nextInterceptor;
  return () => {
    if (interceptor === nextInterceptor) interceptor = null;
  };
}

export function clearApiWriteInterceptor(): void {
  interceptor = null;
}

export async function repositoryFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const method = String(init?.method ?? "GET").toUpperCase();
  const nativeWrite = () => fetchRetryingTransientConflict(input, init);
  if (!isWriteMethod(method)) return globalThis.fetch(input, init);

  return interceptor
    ? interceptor({ input, init, method }, nativeWrite)
    : nativeWrite();
}

/**
 * Header the backend sets on a 409 that came from an optimistic-concurrency race (a row
 * version changed between read and save) rather than from a domain rule. Such conflicts
 * clear on their own, so one automatic retry keeps a background sync from turning a
 * user's submit into an error toast.
 */
const TRANSIENT_CONFLICT_HEADER = "X-REE-Transient-Conflict";
const TRANSIENT_CONFLICT_RETRY_DELAY_MS = 300;

/**
 * Header the backend sets on a 409 when a request carrying the same Idempotency-Key is still
 * running (a double submit, or a retry that overtook its first attempt). The first attempt
 * finishes within seconds, so one wait of Retry-After and a second try returns its replay.
 */
const IDEMPOTENCY_IN_PROGRESS_HEADER = "Idempotency-Key-In-Progress";
const IDEMPOTENCY_IN_PROGRESS_DEFAULT_DELAY_MS = 1_000;
const IDEMPOTENCY_IN_PROGRESS_MAX_DELAY_MS = 5_000;

async function fetchRetryingTransientConflict(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const first = await globalThis.fetch(input, init);
  if (!isReplayableBody(init?.body)) return first;
  if (isTransientConflict(first)) {
    await delay(TRANSIENT_CONFLICT_RETRY_DELAY_MS);
    return globalThis.fetch(input, init);
  }
  if (isIdempotencyInProgress(first)) {
    await delay(retryAfterMs(first));
    return globalThis.fetch(input, init);
  }
  return first;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientConflict(response: Response): boolean {
  return response.status === 409 && response.headers.has(TRANSIENT_CONFLICT_HEADER);
}

function isIdempotencyInProgress(response: Response): boolean {
  return response.status === 409 && response.headers.get(IDEMPOTENCY_IN_PROGRESS_HEADER) === "true";
}

/** Retry-After in seconds, bounded so a bad header cannot stall the UI. */
function retryAfterMs(response: Response): number {
  const seconds = Number(response.headers.get("Retry-After"));
  if (!Number.isFinite(seconds) || seconds <= 0) return IDEMPOTENCY_IN_PROGRESS_DEFAULT_DELAY_MS;
  return Math.min(seconds * 1_000, IDEMPOTENCY_IN_PROGRESS_MAX_DELAY_MS);
}

/** A stream body is consumed by the first attempt; everything else can be sent again. */
function isReplayableBody(body: RequestInit["body"]): boolean {
  return !(typeof ReadableStream !== "undefined" && body instanceof ReadableStream);
}

function isWriteMethod(method: string): method is ApiWriteMethod {
  return (
    method === "POST" ||
    method === "PUT" ||
    method === "PATCH" ||
    method === "DELETE"
  );
}
