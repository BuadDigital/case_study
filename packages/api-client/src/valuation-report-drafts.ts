import { authHeaders, getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import { parseJson, serverFailure } from "./parse-json";
import type { ValuationSelectionsApiConfig } from "./valuation-comparable-selections";

export type ValuationReportDraftStatus = "none" | "preparing" | "sent" | "approved";

/**
 * The valuation-report draft of a request. After the appraiser hands his package over, the case
 * specialist prepares the report and sends it; the assigned appraiser approves (freezing the deposit
 * copy) or takes his approval back before a deposit code is recorded.
 */
export type ValuationReportDraftDto = {
  valuationRequestId: string;
  /** PRV-… once the report was approved (or its number confirmed on the way to approval); null before. */
  reportNumber?: string | null;
  draftId?: string | null;
  status: ValuationReportDraftStatus;
  /** Report cycle: 1 until a deposited report is reopened as a new version. */
  version: number;
  /** The appraiser's package: none | draft | submitted | reopened | unknown. */
  packageStatus: string;
  /** The specialist may prepare the draft now. */
  canPrepare: boolean;
  /** The specialist's report choices (ESG, print attachments): they overlay the appraiser's own. */
  specialistChoices?: Record<string, unknown> | null;
  specialistNote?: string | null;
  appraiserNote?: string | null;
  conformityConfirmedAtUtc?: string | null;
  sentAtUtc?: string | null;
  approvedAtUtc?: string | null;
  reportDate?: string | null;
  hasSnapshot: boolean;
  snapshotSha256?: string | null;
  updatedAtUtc: string;
  /** Where the report copy stands: draft | deposit_issued (approved, waiting for the code) | final_issued. */
  reportStage: "draft" | "deposit_issued" | "final_issued";
  /** The Qeema deposit code recorded for this cycle (the appraiser may correct it after the final issuance). */
  depositCode?: string | null;
  certificateFileName?: string | null;
  finalIssuedAtUtc?: string | null;
  /** The generated final PDF (report + deposit code + certificate page): none | preparing | ready. */
  finalReportStatus?: FinalReportStatus;
};

export type FinalReportStatus = "none" | "preparing" | "ready";

/** One property's draft state for queue labels (no content). */
export type ReportDraftStateDto = {
  propertyId: string;
  status: ValuationReportDraftStatus;
  reportStage: "draft" | "deposit_issued" | "final_issued";
  /** The appraiser's progress ladder 0–100 (hand-over to the specialist, 75, is raised by the reader). */
  progressPct?: number;
};

type Result<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      kind: "auth" | "forbidden" | "network" | "server" | "validation" | "not_found";
      message?: string;
      errors?: Record<string, string>;
    };

function path(valuationRequestId: string, tail = ""): string {
  return `/api/valuation-requests/${encodeURIComponent(valuationRequestId)}/report-draft${tail}`;
}

async function readResult(res: Response): Promise<Result<ValuationReportDraftDto>> {
  if (res.status === 401) return { ok: false, kind: "auth" };
  if (res.status === 404) return { ok: false, kind: "not_found" };
  if (res.status === 403 || res.status === 400 || res.status === 409) {
    const payload = (await res.json().catch(() => null)) as {
      errors?: Record<string, string | string[]>;
      detail?: string;
      message?: string;
    } | null;
    const errors = Object.fromEntries(
      Object.entries(payload?.errors ?? {}).map(([k, v]) => [k, Array.isArray(v) ? (v[0] ?? "") : v]),
    );
    return {
      ok: false,
      kind: res.status === 403 ? "forbidden" : "validation",
      message:
        Object.values(errors)[0] ??
        payload?.detail ??
        payload?.message ??
        (res.status === 403 ? "ليس لديك صلاحية هذا الإجراء" : "تعذّر تنفيذ الإجراء على مسودة التقرير"),
      errors,
    };
  }
  if (!res.ok) return await serverFailure(res);
  return { ok: true, data: await parseJson<ValuationReportDraftDto>(res) };
}

async function send(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  tail: string,
  method: "GET" | "POST" | "PUT",
  body?: unknown,
): Promise<Result<ValuationReportDraftDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}${path(valuationRequestId, tail)}`, {
      method,
      headers: authHeaders(config.token, { accept: true }),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return await readResult(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** The draft state of a property's latest valuation request (the pages know the property, not the request). */
export async function getReportDraftByProperty(
  config: ValuationSelectionsApiConfig,
  propertyId: string,
): Promise<Result<ValuationReportDraftDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-report-drafts/by-property/${encodeURIComponent(propertyId)}`,
      { headers: authHeaders(config.token, { accept: true }) },
    );
    return await readResult(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** The specialist saves his report choices — only while the draft is being prepared. */
export function saveReportDraftChoices(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  choices: Record<string, unknown>,
): Promise<Result<ValuationReportDraftDto>> {
  return send(config, valuationRequestId, "/choices", "PUT", { choices });
}

/** The specialist sends the draft to the appraiser, confirming it matches the property study. */
export function sendReportDraft(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  body: { conformityConfirmed: boolean; note?: string },
): Promise<Result<ValuationReportDraftDto>> {
  return send(config, valuationRequestId, "/send", "POST", body);
}

/** The specialist pulls a sent draft back to preparing. */
export function withdrawReportDraft(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  note?: string,
): Promise<Result<ValuationReportDraftDto>> {
  return send(config, valuationRequestId, "/withdraw", "POST", { note });
}

export type ValuationReportNumberDto = {
  valuationRequestId: string;
  /** PRV-{YY}-{seq}, derived from the transaction's official reference. */
  reportNumber: string;
};

/**
 * Fixes the report number before the approved copy is printed (decision 2026-10-19): the
 * transaction's official PR reference is confirmed through Case Study and PRV-… returned. Idempotent.
 *
 * How it works: POST `/report-number` on the valuation request; 401 → auth, 403 → forbidden,
 * 404 → not_found, other failures → server (5xx) or validation (4xx) with the server's message
 * (`problemMessage`); success returns `{ valuationRequestId, reportNumber }`.
 *
 * Edge cases: PR is drawn once at the first approved report and never reused, so calling it
 * again (a retry, a later version, an approval after a reopen) returns the same number; a
 * success body without a number → server error, so the caller never prints an empty number.
 */
export async function ensureReportNumber(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
): Promise<Result<ValuationReportNumberDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}${path(valuationRequestId, "/report-number")}`, {
      method: "POST",
      headers: authHeaders(config.token, { accept: true }),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden", message: await problemMessage(res) };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) {
      return { ok: false, kind: res.status >= 500 ? "server" : "validation", message: await problemMessage(res) };
    }
    const data = (await parseJson<ValuationReportNumberDto>(res)) ?? null;
    if (!data?.reportNumber) return { ok: false, kind: "server" };
    return { ok: true, data };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/**
 * The message of a problem-details refusal: `detail`, else the first field error, else
 * `title`; undefined when the body is not JSON. Reads a clone, so the response stays readable.
 */
async function problemMessage(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.clone().json()) as { detail?: string; title?: string; errors?: Record<string, string> };
    const firstError = body?.errors ? Object.values(body.errors).find((v) => typeof v === "string" && v) : undefined;
    return body?.detail || firstError || body?.title || undefined;
  } catch {
    return undefined;
  }
}

/** The assigned appraiser approves the sent draft: the printed report as he saw it + its date. */
export function approveReportDraft(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  body: { reportDate: string; html: string },
): Promise<Result<ValuationReportDraftDto>> {
  return send(config, valuationRequestId, "/approve", "POST", body);
}

/** The assigned appraiser takes his approval back — only before a deposit code is recorded. */
export function withdrawReportDraftApproval(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  note?: string,
): Promise<Result<ValuationReportDraftDto>> {
  return send(config, valuationRequestId, "/withdraw-approval", "POST", { note });
}

/** Draft states of several properties at once (queue status labels); properties with no request are left out. */
export async function listReportDraftStates(
  config: ValuationSelectionsApiConfig,
  propertyIds: readonly string[],
): Promise<Result<ReportDraftStateDto[]>> {
  const ids = [...new Set(propertyIds.map((x) => x.trim()).filter(Boolean))];
  if (ids.length === 0) return { ok: true, data: [] };
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-report-drafts/states?propertyIds=${encodeURIComponent(ids.join(","))}`,
      { headers: authHeaders(config.token, { accept: true }) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return await serverFailure(res);
    return { ok: true, data: await parseJson<ReportDraftStateDto[]>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** The generated final report PDF. `preparing` (409) means it is not generated yet — retry with `generateFinalReport`. */
export async function downloadFinalReport(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
): Promise<Result<Blob>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}${path(valuationRequestId, "/final-report")}`, {
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) {
      return { ok: false, kind: "forbidden", message: "تقرير التقييم النهائي للأخصائي والإدارة والمقيّم المُسنَد" };
    }
    if (res.status === 409 || res.status === 404) {
      return { ok: false, kind: "not_found", message: "ملف التقرير النهائي قيد الإعداد — أعد المحاولة بعد قليل" };
    }
    if (!res.ok) return await serverFailure(res);
    return { ok: true, data: await res.blob() };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** Retries generating the final report PDF (the renderer was down, or the code changed); returns its status. */
export async function generateFinalReport(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
): Promise<Result<{ finalReportStatus: FinalReportStatus }>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}${path(valuationRequestId, "/final-report/generate")}`, {
      method: "POST",
      headers: authHeaders(config.token, { accept: true }),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return await serverFailure(res);
    return { ok: true, data: await parseJson<{ finalReportStatus: FinalReportStatus }>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}
