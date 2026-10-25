/** Typed res.json() — was copy-pasted in five api-client modules. */
export async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

/** The `{ error }` (or `{ Error }`) text of a failed fee/billing answer, else `HTTP <status>`. */
export async function readErrorText(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as Record<string, unknown>;
    return String(body.error ?? body.Error ?? `HTTP ${res.status}`);
  } catch {
    return `HTTP ${res.status}`;
  }
}
