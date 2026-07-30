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
  const nativeWrite = () => globalThis.fetch(input, init);
  if (!isWriteMethod(method)) return nativeWrite();

  return interceptor
    ? interceptor({ input, init, method }, nativeWrite)
    : nativeWrite();
}

function isWriteMethod(method: string): method is ApiWriteMethod {
  return (
    method === "POST" ||
    method === "PUT" ||
    method === "PATCH" ||
    method === "DELETE"
  );
}
