import { getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import { parseJson } from "./parse-json";
import type { ValuationSelectionsApiConfig } from "./valuation-comparable-selections";

/** null = no effect. */
export type ValueDocumentEffect = "indicator" | "addition";

export type ValueDocumentApproachKey = "market" | "cost" | "income";

/** A «مستند ذو قيمة» of the request's property with the appraiser's decision on it. */
export type ValuationValueDocumentDto = {
  attachmentId: string;
  labelAr: string;
  fileName: string;
  contentType: string;
  createdAtUtc?: string | null;
  /** The case specialist's decision: pending / approved / rejected. */
  status: string;
  reviewNote?: string | null;
  /** Used, but no longer on the property. */
  missing: boolean;
  effect?: ValueDocumentEffect | null;
  approachKey?: ValueDocumentApproachKey | null;
  methodName?: string | null;
  value?: number | null;
};

export type ValuationValueDocumentsDto = {
  valuationRequestId: string;
  /** Approaches valued internally — a document indicator cannot use them. */
  internalApproachKinds: string[];
  documents: ValuationValueDocumentDto[];
};

export type SaveValuationValueDocumentUseRequest = {
  attachmentId: string;
  effect: ValueDocumentEffect;
  approachKey?: ValueDocumentApproachKey | null;
  methodName?: string | null;
  value: number;
};

type Result<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      kind: "auth" | "forbidden" | "network" | "server" | "validation" | "not_found";
      message?: string;
      errors?: Record<string, string>;
    };

function headers(token: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function path(valuationRequestId: string): string {
  return `/api/valuation-requests/${encodeURIComponent(valuationRequestId)}/value-documents`;
}

async function readResult(res: Response): Promise<Result<ValuationValueDocumentsDto>> {
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
      message: Object.values(errors)[0] ?? payload?.detail ?? "تعذّر حفظ أثر المستندات",
      errors,
    };
  }
  if (!res.ok) return { ok: false, kind: "server" };
  return { ok: true, data: await parseJson<ValuationValueDocumentsDto>(res) };
}

export async function getValuationValueDocuments(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
): Promise<Result<ValuationValueDocumentsDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}${path(valuationRequestId)}`, {
      headers: headers(config.token),
    });
    return await readResult(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** The appraiser's decision on each valued document; documents left out have no effect. */
export async function saveValuationValueDocuments(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  uses: SaveValuationValueDocumentUseRequest[],
): Promise<Result<ValuationValueDocumentsDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}${path(valuationRequestId)}`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify({ uses }),
    });
    return await readResult(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}
