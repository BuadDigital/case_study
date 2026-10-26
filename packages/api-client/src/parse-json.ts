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

/**
 * The message of a problem-details refusal: `detail`, else the first field error, else `title`;
 * undefined when the body is not JSON. Reads a clone, so the response stays readable.
 * (One copy for the transactions and valuation-report-draft clients — 2026-10-26 reuse clean-up.)
 */
export async function readProblemMessage(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.clone().json()) as { detail?: string; title?: string; errors?: Record<string, string> };
    const firstError = body?.errors ? Object.values(body.errors).find((v) => typeof v === "string" && v) : undefined;
    return body?.detail || firstError || body?.title || undefined;
  } catch {
    return undefined;
  }
}

/**
 * A failed answer reported as `server`. A 503 carries its reason in the problem `detail` — e.g. the
 * valuation service could not reach Case Study to check the assigned appraiser («تعذّر التحقق من
 * المقيّم المُسنَد — أعد المحاولة») — and that reason is kept, not replaced by a generic failure.
 */
export async function serverFailure(
  res: Response,
): Promise<{ ok: false; kind: "server"; message?: string }> {
  if (res.status !== 503) return { ok: false, kind: "server" };
  try {
    const body = (await res.json()) as { detail?: unknown; message?: unknown };
    const text = [body.detail, body.message].find((v) => typeof v === "string" && v.trim());
    return typeof text === "string" ? { ok: false, kind: "server", message: text.trim() } : { ok: false, kind: "server" };
  } catch {
    return { ok: false, kind: "server" };
  }
}
