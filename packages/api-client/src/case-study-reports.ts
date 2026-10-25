import { parseFieldErrorsFromResponse } from "./field-errors";
import { authHeaders, getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

export type CaseStudyReportDto = {
  taskId: string;
  propertyId?: string;
  poNumber?: string;
  status: string;
  currentStep: number;
  requestNumber: string;
  requestDate: string;
  deedNumber: string;
  answers: Record<string, unknown>;
  answerProvenance?: Record<string, AnswerProvenanceEntryDto>;
  deedRemarks: string;
  surveyRemarks: string;
  componentsRemarks: string;
  occupancyRemarks: string;
  meterType: string;
  meterNumber: string;
  hoaFee: string;
  sigDeed: string;
  sigApprover: string;
  sigDate: string;
  specialistReviewApproved?: Record<string, boolean>;
  infathLinkedAssets?: string;
  infathLinkedDeedNumbers?: string;
  infathLinkedAssetsNotes?: string;
  infathOtherNotes?: string;
  infathClosingNotes?: string;
  deedNatureMatchOutcome?: string;
  deedNatureMatchNotes?: string;
  savedAtUtc?: string;
};

type AnswerProvenanceEntryDto = {
  value?: string | null;
  sourcePartyId?: string | null;
  sourceRole?: string | null;
  matrixRole?: string | null;
  workflowTaskId: string;
  formId?: string | null;
  answeredByUserId?: string | null;
  answeredByName?: string | null;
  answeredAtUtc: string;
};

export async function getCaseStudyReport(
  config: WorkOrdersApiConfig,
  taskId: string,
): Promise<ApiOk<CaseStudyReportDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/case-study-reports/${taskId}`, {
      headers: authHeaders(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as CaseStudyReportDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** 403 with the server's reason in field error `_`, else the generic no-permission text. */
async function forbiddenError(res: Response): Promise<ApiErr> {
  const errors = await parseFieldErrorsFromResponse(res);
  const message =
    errors._?.trim() || "ليس لديك صلاحية لهذا الإجراء";
  return { ok: false, kind: "forbidden", message, errors: { _: message, ...errors } };
}

/** A report save's answer (specialist or party): 409 means another session saved first. */
async function readReportSave(res: Response): Promise<ApiOk<CaseStudyReportDto> | ApiErr> {
  if (res.status === 401) return { ok: false, kind: "auth" };
  if (res.status === 403) return forbiddenError(res);
  if (res.status === 400) {
    const errors = await parseFieldErrorsFromResponse(res);
    return { ok: false, kind: "validation", errors };
  }
  if (res.status === 409) {
    const errors = await parseFieldErrorsFromResponse(res);
    const message =
      errors._?.trim() ||
      "تم تحديث التقرير من جلسة أخرى. حدّث الصفحة ثم أعد الحفظ.";
    return {
      ok: false,
      kind: "validation",
      message,
      errors: { _: message, ...errors },
    };
  }
  if (!res.ok) return { ok: false, kind: "server" };
  return { ok: true, data: (await res.json()) as CaseStudyReportDto };
}

export async function saveCaseStudyReport(
  config: WorkOrdersApiConfig,
  taskId: string,
  report: CaseStudyReportDto,
  idempotencyKey?: string,
): Promise<ApiOk<CaseStudyReportDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/case-study-reports/${taskId}`, {
      method: "PUT",
      headers: authHeaders(config.token, { idempotencyKey }),
      body: JSON.stringify({ report }),
    });
    return await readReportSave(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** `POST /api/case-study-reports/{taskId}/reopen` answer. */
export type ReopenCaseStudyReportResult = {
  report: CaseStudyReportDto;
  /** The appraiser had already submitted — their submission closes again until the report is re-issued. */
  appraiserSubmitted: boolean;
  /** The Enfaz handover stamp was cleared by this call (`clearEnfazHandover: true`). */
  enfazHandoverCleared: boolean;
};

/**
 * POST of an issue / reopen action. 400 and 409 both carry field errors: `answers` /
 * `missingQuestionKeys` on issue, `enfazHandover` / `reason` on reopen — the 409 keeps them
 * instead of the stale-session message `saveCaseStudyReport` falls back to.
 */
async function postCaseStudyReportAction<T>(
  config: WorkOrdersApiConfig,
  taskId: string,
  action: "issue" | "reopen",
  body: unknown,
): Promise<ApiOk<T> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/case-study-reports/${taskId}/${action}`, {
      method: "POST",
      headers: authHeaders(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return await forbiddenError(res);
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (res.status === 400 || res.status === 409) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "validation", errors };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** Specialist-only: validate completeness server-side and issue the report (status `issued`). */
export async function issueCaseStudyReport(
  config: WorkOrdersApiConfig,
  taskId: string,
  report: CaseStudyReportDto,
): Promise<ApiOk<CaseStudyReportDto> | ApiErr> {
  return postCaseStudyReportAction<CaseStudyReportDto>(config, taskId, "issue", {
    report,
  });
}

/**
 * Specialist-only: reopen an issued report (issued → draft). A property already handed over to
 * Enfaz answers an `enfazHandover` field error unless `clearEnfazHandover` is true.
 */
export async function reopenCaseStudyReport(
  config: WorkOrdersApiConfig,
  taskId: string,
  request: { reason: string; clearEnfazHandover: boolean },
): Promise<ApiOk<ReopenCaseStudyReportResult> | ApiErr> {
  return postCaseStudyReportAction<ReopenCaseStudyReportResult>(
    config,
    taskId,
    "reopen",
    { reason: request.reason, clearEnfazHandover: request.clearEnfazHandover },
  );
}

export async function getPartyCaseStudyReport(
  config: WorkOrdersApiConfig,
  taskId: string,
): Promise<ApiOk<CaseStudyReportDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/case-study-reports/party/${taskId}`, {
      headers: authHeaders(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as CaseStudyReportDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** One case-study parent with its party children — `GET /api/case-study-reports/batch`. */
export type CaseStudyReportBatchItemDto = {
  parentTaskId: string;
  /** The specialist's (non-party) report; an unsaved empty report when no row exists yet. */
  parent: CaseStudyReportDto;
  /** Party contributions of the parent's child tasks, keyed by child workflow-task id. */
  partyContributionsByChildTaskId: Record<string, CaseStudyReportDto>;
};

export type CaseStudyReportBatchDto = {
  /**
   * Keyed by parent workflow-task id. A parent the actor may not read, or that does
   * not exist, is absent — the same "not found" the single-item GETs answer with.
   */
  byParentTaskId: Record<string, CaseStudyReportBatchItemDto>;
};

/** Server cap on distinct `parentTaskIds` per batch request (400 above it). */
export const CASE_STUDY_REPORT_BATCH_MAX_IDS = 100;

/**
 * The case-study report of every listed parent plus the party contributions of its children in
 * one request — replaces the per-row `getCaseStudyReport` + N × `getPartyCaseStudyReport`
 * the active queue used to issue. At most `CASE_STUDY_REPORT_BATCH_MAX_IDS` ids per call;
 * chunk above that. Same visibility rule as the single-item reads.
 */
export async function getCaseStudyReportsBatch(
  config: WorkOrdersApiConfig,
  parentTaskIds: readonly string[],
): Promise<ApiOk<CaseStudyReportBatchDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  const params = new URLSearchParams({ parentTaskIds: parentTaskIds.join(",") });
  try {
    const res = await fetch(`${base}/api/case-study-reports/batch?${params}`, {
      headers: authHeaders(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "validation", errors };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as CaseStudyReportBatchDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function savePartyCaseStudyReport(
  config: WorkOrdersApiConfig,
  taskId: string,
  report: CaseStudyReportDto,
): Promise<ApiOk<CaseStudyReportDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/case-study-reports/party/${taskId}`, {
      method: "PUT",
      headers: authHeaders(config.token),
      body: JSON.stringify({ report }),
    });
    return await readReportSave(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}
