import { parseFieldErrorsFromResponse } from "./field-errors";
import { getApiBase } from "./api-base";
import { withIdempotencyKey } from "./idempotency-key";
import { repositoryFetch as fetch } from "./write-repository";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

export type CaseStudyFormDto = {
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

export type AnswerProvenanceEntryDto = {
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

function headers(token: string, idempotencyKey?: string): HeadersInit {
  const base = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  return idempotencyKey ? withIdempotencyKey(base, idempotencyKey) : base;
}

export async function getCaseStudyForm(
  config: WorkOrdersApiConfig,
  taskId: string,
): Promise<ApiOk<CaseStudyFormDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/case-study-forms/${taskId}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as CaseStudyFormDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function saveCaseStudyForm(
  config: WorkOrdersApiConfig,
  taskId: string,
  form: CaseStudyFormDto,
  idempotencyKey?: string,
): Promise<ApiOk<CaseStudyFormDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/case-study-forms/${taskId}`, {
      method: "PUT",
      headers: headers(config.token, idempotencyKey),
      body: JSON.stringify({ form }),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "validation", errors };
    }
    if (res.status === 409) {
      const errors = await parseFieldErrorsFromResponse(res);
      const message =
        errors._?.trim() ||
        "تم تحديث النموذج من جلسة أخرى. حدّث الصفحة ثم أعد الحفظ.";
      return {
        ok: false,
        kind: "validation",
        message,
        errors: { _: message, ...errors },
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as CaseStudyFormDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function getPartyCaseStudyForm(
  config: WorkOrdersApiConfig,
  taskId: string,
): Promise<ApiOk<CaseStudyFormDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/case-study-forms/party/${taskId}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as CaseStudyFormDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** One case-study parent with its party children — `GET /api/case-study-forms/batch`. */
export type CaseStudyFormBatchItemDto = {
  parentTaskId: string;
  /** The specialist's (non-party) form; an unsaved empty form when no row exists yet. */
  parent: CaseStudyFormDto;
  /** Party forms of the parent's child tasks, keyed by child workflow-task id. */
  partyFormsByChildTaskId: Record<string, CaseStudyFormDto>;
};

export type CaseStudyFormBatchDto = {
  /**
   * Keyed by parent workflow-task id. A parent the actor may not read, or that does
   * not exist, is absent — the same "not found" the single-item GETs answer with.
   */
  byParentTaskId: Record<string, CaseStudyFormBatchItemDto>;
};

/** Server cap on distinct `parentTaskIds` per batch request (400 above it). */
export const CASE_STUDY_FORM_BATCH_MAX_IDS = 100;

/**
 * The case-study form of every listed parent plus the party forms of its children in
 * one request — replaces the per-row `getCaseStudyForm` + N × `getPartyCaseStudyForm`
 * the active queue used to issue. At most `CASE_STUDY_FORM_BATCH_MAX_IDS` ids per call;
 * chunk above that. Same visibility rule as the single-item reads.
 */
export async function getCaseStudyFormsBatch(
  config: WorkOrdersApiConfig,
  parentTaskIds: readonly string[],
): Promise<ApiOk<CaseStudyFormBatchDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  const params = new URLSearchParams({ parentTaskIds: parentTaskIds.join(",") });
  try {
    const res = await fetch(`${base}/api/case-study-forms/batch?${params}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "validation", errors };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as CaseStudyFormBatchDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function savePartyCaseStudyForm(
  config: WorkOrdersApiConfig,
  taskId: string,
  form: CaseStudyFormDto,
): Promise<ApiOk<CaseStudyFormDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/case-study-forms/party/${taskId}`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify({ form }),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "validation", errors };
    }
    if (res.status === 409) {
      const errors = await parseFieldErrorsFromResponse(res);
      const message =
        errors._?.trim() ||
        "تم تحديث النموذج من جلسة أخرى. حدّث الصفحة ثم أعد الحفظ.";
      return {
        ok: false,
        kind: "validation",
        message,
        errors: { _: message, ...errors },
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as CaseStudyFormDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}
