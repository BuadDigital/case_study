import {
  fetchPartySubmission,
  getCachedPartySubmission,
  payloadFromDto,
  persistPartySubmissionPayload,
  prefetchPartySubmissionsForTasks,
  submitPartySubmission,
} from "@platform/app-shared/prototype/party-submission-api";
import { notifyTasksChanged } from "@case-study/mfe/lib/prototype/tasks-storage";
import { dispatchPartySubmissionChanged } from "@platform/app-shared/prototype/party-submission-changed-event";
import { dispatchWorkflowSubmitted, EVALUATOR_SUBMITTED_EVENT } from "@platform/app-shared/prototype/party-workflow-events";
import { loadPartyCaseStudyFormDraft } from "@case-study/mfe/lib/prototype/case-study-form-storage";
import { mergeEvaluatorChecklistFromCaseStudy } from "./evaluator-checklist-case-study-sync";
import { basisOfValueLabelArForAssignment } from "@platform/app-shared/prototype/assignment-valuation-defaults";
import {
  createEvaluatorDraft,
  normalizeReportChoices,
  normalizeReportWorkers,
  seedReportChoicesFromAssignment,
  type EvaluatorSubmission,
  type EvaluatorSubmissionStatus,
} from "./evaluator-window-data";
import { reservedValuationReportNumber } from "./valuation-report-number";
import { getApiBase, ensureOpenValuationRequestByProperty } from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import { apiConfig } from "./api-config";

export const EVALUATOR_SUBMISSION_CHANGED_EVENT = "evaluator-submission-changed";

export type EvaluatorReportMetadata = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  attachmentId?: string;
};

export type EvaluatorPlanImageMetadata = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  attachmentId?: string;
};

function notifyEvaluatorSubmissionChanged(): void {
  dispatchPartySubmissionChanged(EVALUATOR_SUBMISSION_CHANGED_EVENT);
}

function dtoToSubmission(
  dto: ReturnType<typeof getCachedPartySubmission>,
  assignmentType?: string,
): EvaluatorSubmission | null {
  if (!dto) return null;
  const payload = payloadFromDto<EvaluatorSubmission>(dto);
  const base = createEvaluatorDraft({
    taskId: dto.taskId,
    propertyId: payload.propertyId ?? dto.propertyId ?? "",
    poNumber: payload.poNumber ?? dto.poNumber ?? "",
    assignmentType,
  });
  return {
    ...base,
    ...payload,
    taskId: dto.taskId,
    propertyId: payload.propertyId ?? dto.propertyId ?? "",
    poNumber: payload.poNumber ?? dto.poNumber ?? "",
    status: (dto.status as EvaluatorSubmissionStatus) ?? payload.status,
    reportNo:
      typeof payload.reportNo === "string" ? payload.reportNo : base.reportNo,
    independenceDeclared: Boolean(payload.independenceDeclared),
    reportWorkers: normalizeReportWorkers(payload.reportWorkers),
    assetDataConfirmed: Boolean(payload.assetDataConfirmed),
    assetDataVarianceNotes:
      typeof payload.assetDataVarianceNotes === "string"
        ? payload.assetDataVarianceNotes
        : base.assetDataVarianceNotes,
    reportChoices: seedReportChoicesFromAssignment(
      assignmentType,
      undefined,
      normalizeReportChoices(payload.reportChoices),
    ),
    valueBasis: assignmentType
      ? basisOfValueLabelArForAssignment(assignmentType)
      : typeof payload.valueBasis === "string" && payload.valueBasis.trim()
        ? payload.valueBasis
        : base.valueBasis,
    depositCode:
      typeof payload.depositCode === "string" ? payload.depositCode : base.depositCode,
    depositCertificateFileName: payload.depositCertificateFileName ?? null,
    appraiserAddress:
      typeof payload.appraiserAddress === "string" &&
      payload.appraiserAddress.trim()
        ? payload.appraiserAddress
        : base.appraiserAddress,
    appraiserPhone:
      typeof payload.appraiserPhone === "string" && payload.appraiserPhone.trim()
        ? payload.appraiserPhone
        : base.appraiserPhone,
    submittedAtUtc: dto.submittedAtUtc ?? payload.submittedAtUtc ?? null,
    updatedAtUtc: dto.updatedAtUtc ?? payload.updatedAtUtc,
  };
}

function submissionPayload(
  submission: EvaluatorSubmission,
  reportMetadata?: EvaluatorReportMetadata | null,
  planImageMetadata?: EvaluatorPlanImageMetadata | null,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...submission };
  if (reportMetadata) payload.reportMetadata = reportMetadata;
  if (planImageMetadata) payload.planImageMetadata = planImageMetadata;
  return payload;
}

/** Sync read from in-memory cache (queue filters). */
export function loadEvaluatorSubmission(
  taskId: string,
): EvaluatorSubmission | null {
  return dtoToSubmission(getCachedPartySubmission(taskId));
}

export async function fetchEvaluatorSubmission(
  taskId: string,
): Promise<EvaluatorSubmission | null> {
  const dto = await fetchPartySubmission(taskId);
  return dtoToSubmission(dto);
}

export const fetchEvaluatorSubmissionSnapshot = fetchEvaluatorSubmission;

export async function hydrateEvaluatorSubmission(input: {
  taskId: string;
  propertyId: string;
  poNumber: string;
  assignmentType?: string;
}): Promise<EvaluatorSubmission> {
  const existing = dtoToSubmission(
    await fetchPartySubmission(input.taskId),
    input.assignmentType,
  );
  const draft = existing ?? createEvaluatorDraft(input);
  if (!existing) {
    const saved = await saveEvaluatorSubmission(draft);
    if (!saved) {
      throw new Error("تعذّر حفظ مسودة التقييم — تحقق من الاتصال وحاول مجدداً.");
    }
    return stampReservedReportNumber(saved);
  }
  return stampReservedReportNumber(existing);
}

async function stampReservedReportNumber(
  submission: EvaluatorSubmission,
): Promise<EvaluatorSubmission> {
  if (submission.reportNo.trim() || !submission.propertyId.trim()) {
    return submission;
  }
  const config = apiConfig();
  if (!config) return submission;
  try {
    const open = await ensureOpenValuationRequestByProperty(
      config,
      {
        propId: submission.propertyId,
        area: "—",
        type: "—",
        appraiser: "—",
      },
    );
    if (!open.ok) return submission;
    const reportNo = reservedValuationReportNumber(open.data.displayId, open.data.date);
    if (!reportNo.trim()) return submission;
    const saved = await saveEvaluatorSubmission({ ...submission, reportNo });
    return saved ?? { ...submission, reportNo };
  } catch (err) {
    // حجز رقم التقرير أفضل-جهد — فشله لا يمنع فتح المسودة، لكنه لم يعد صامتاً.
    console.warn("تعذّر حجز رقم تقرير التقييم", err);
    return submission;
  }
}

export async function syncEvaluatorChecklistFromPartyCaseStudy(
  appraisalTaskId: string,
  options: { overwriteLinked?: boolean } = {},
): Promise<EvaluatorSubmission | null> {
  const current = loadEvaluatorSubmission(appraisalTaskId);
  if (!current) return null;
  if (current.status === "submitted" || current.status === "completed") {
    return current;
  }

  const partyDraft = await loadPartyCaseStudyFormDraft(appraisalTaskId);
  if (!partyDraft) return current;

  const checklist = mergeEvaluatorChecklistFromCaseStudy(
    current.checklist,
    partyDraft.answers,
    {
      deedRemarks: partyDraft.deedRemarks,
      componentsRemarks: partyDraft.componentsRemarks,
    },
    { overwriteLinked: options.overwriteLinked ?? true },
  );

  const saved = await saveEvaluatorSubmission({ ...current, checklist });
  if (saved) notifyEvaluatorSubmissionChanged();
  return saved;
}

export async function saveEvaluatorSubmission(
  submission: EvaluatorSubmission,
  reportMetadata?: EvaluatorReportMetadata | null,
  planImageMetadata?: EvaluatorPlanImageMetadata | null,
): Promise<EvaluatorSubmission | null> {
  if (!submission.taskId) return null;
  const payload = submissionPayload(
    { ...submission, updatedAtUtc: new Date().toISOString() },
    reportMetadata,
    planImageMetadata,
  );
  const saved = await persistPartySubmissionPayload(submission.taskId, payload);
  if (!saved.ok) return null;
  return dtoToSubmission(saved.data);
}

type EvaluatorDraftPatch = Partial<
  Omit<
    EvaluatorSubmission,
    "taskId" | "propertyId" | "poNumber" | "status" | "submittedAtUtc" | "updatedAtUtc"
  >
>;

export async function updateEvaluatorDraft(
  taskId: string,
  patch: EvaluatorDraftPatch,
  reportMetadata?: EvaluatorReportMetadata | null,
  planImageMetadata?: EvaluatorPlanImageMetadata | null,
): Promise<EvaluatorSubmission | null> {
  const current = loadEvaluatorSubmission(taskId);
  if (!current) return null;
  if (current.status === "submitted" || current.status === "completed") {
    return current;
  }
  const next: EvaluatorSubmission = {
    ...current,
    ...patch,
    checklist: patch.checklist
      ? { ...current.checklist, ...patch.checklist }
      : current.checklist,
    status:
      current.status === "reopened" ? "reopened" : ("draft" as const),
    updatedAtUtc: new Date().toISOString(),
  };
  return saveEvaluatorSubmission(next, reportMetadata, planImageMetadata);
}

export async function submitEvaluatorSubmission(
  taskId: string,
): Promise<
  | { ok: true; submission: EvaluatorSubmission }
  | { ok: false; message: string }
> {
  const current = loadEvaluatorSubmission(taskId);
  if (!current) {
    return { ok: false, message: "لا توجد مسودة للإرسال" };
  }
  if (current.status === "submitted" || current.status === "completed") {
    return { ok: true, submission: current };
  }

  const saved = await saveEvaluatorSubmission({
    ...current,
    status: "draft",
    updatedAtUtc: new Date().toISOString(),
  });
  if (!saved) {
    return {
      ok: false,
      message: "تعذّر حفظ المسودة قبل الإرسال — تحقق من الاتصال ثم أعد المحاولة",
    };
  }

  const submitted = await submitPartySubmission(taskId);
  if (!submitted.ok) {
    return {
      ok: false,
      message: submitted.error || "تعذّر إرسال التقييم — تحقق من الحقول والاتصال",
    };
  }

  notifyEvaluatorSubmissionChanged();
  dispatchWorkflowSubmitted(EVALUATOR_SUBMITTED_EVENT);
  notifyTasksChanged();

  const submission = dtoToSubmission(submitted.data);
  if (!submission) {
    return { ok: false, message: "تعذّر قراءة استجابة الإرسال" };
  }
  return { ok: true, submission };
}

export async function prefetchEvaluatorSubmissions(
  taskIds: string[],
): Promise<void> {
  await prefetchPartySubmissionsForTasks(taskIds);
}

export function isVisibleInAppraiserQueue(
  taskId: string,
  taskStatus: string,
  options?: { showSubmitted?: boolean },
): boolean {
  if (taskStatus === "completed") return Boolean(options?.showSubmitted);
  const sub = loadEvaluatorSubmission(taskId);
  if (sub?.status === "submitted") return Boolean(options?.showSubmitted);
  return true;
}

export function isEvaluatorFormLocked(status: EvaluatorSubmissionStatus): boolean {
  return status === "submitted" || status === "completed";
}
