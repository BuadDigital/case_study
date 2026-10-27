// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Reuse New file — sendValuationResource / ValuationResourceResult: one GET / PUT helper for
//          /api/valuation-requests/{id}/{segment} (400 → field errors), replacing per-file copies.
// Round 2 (1b19bedc)
//  • R2   Other failed responses go through serverFailure: a 503 (an unreachable service) now carries the
//         server's Arabic message instead of a bare «server» failure.
// ──────────────────────────────────────────────────────────────────────────────────────────────

import { authHeaders, getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import { parseJson, serverFailure } from "./parse-json";
import type { ValuationSelectionsApiConfig } from "./valuation-comparable-selections";

/** Result of a GET / PUT on one resource under `/api/valuation-requests/{id}/…`. */
export type ValuationResourceResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      kind: "auth" | "forbidden" | "network" | "server" | "validation" | "not_found";
      message?: string;
      errors?: Record<string, string>;
    };

async function readResult<T>(res: Response, invalidMessage: string): Promise<ValuationResourceResult<T>> {
  if (res.status === 401) return { ok: false, kind: "auth" };
  if (res.status === 403) return { ok: false, kind: "forbidden" };
  if (res.status === 404) return { ok: false, kind: "not_found" };
  if (res.status === 400) {
    const payload = (await res.json().catch(() => null)) as {
      errors?: Record<string, string | string[]>;
      detail?: string;
    } | null;
    const errors = Object.fromEntries(
      Object.entries(payload?.errors ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] ?? "" : v]),
    );
    return {
      ok: false,
      kind: "validation",
      message: Object.values(errors)[0] ?? payload?.detail ?? invalidMessage,
      errors,
    };
  }
  if (!res.ok) return await serverFailure(res);
  return { ok: true, data: await parseJson<T>(res) };
}

/**
 * GET (no body) or PUT (with body) `/api/valuation-requests/{id}/{segment}`.
 * `invalidMessage` is shown for a 400 that carries no field message.
 */
export async function sendValuationResource<T>(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  segment: string,
  invalidMessage: string,
  body?: unknown,
): Promise<ValuationResourceResult<T>> {
  const base = config.baseUrl ?? getApiBase();
  const url = `${base}/api/valuation-requests/${encodeURIComponent(valuationRequestId)}/${segment}`;
  try {
    const res = await fetch(
      url,
      body === undefined
        ? { headers: authHeaders(config.token, { accept: true }) }
        : { method: "PUT", headers: authHeaders(config.token, { accept: true }), body: JSON.stringify(body) },
    );
    return await readResult<T>(res, invalidMessage);
  } catch {
    return { ok: false, kind: "network" };
  }
}
