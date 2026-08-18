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
import { loadPartyCaseStudyFormDraft } from "@case-study/mfe";
import { mergeEvaluatorChecklistFromCaseStudy } from "./evaluator-checklist-case-study-sync";
import {
  createEvaluatorDraft,
  type EvaluatorSubmission,
  type EvaluatorSubmissionStatus,
} from "./evaluator-window-data";

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
): EvaluatorSubmission | null {
  if (!dto) return null;
  const payload = payloadFromDto<EvaluatorSubmission>(dto);
  const base = createEvaluatorDraft({
    taskId: dto.taskId,
    propertyId: payload.propertyId ?? dto.propertyId ?? "",
    poNumber: payload.poNumber ?? dto.poNumber ?? "",
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
    reportWorkers: Array.isArray(payload.reportWorkers)
      ? payload.reportWorkers
      : base.reportWorkers,
    assetDataConfirmed: Boolean(payload.assetDataConfirmed),
    assetDataVarianceNotes:
      typeof payload.assetDataVarianceNotes === "string"
        ? payload.assetDataVarianceNotes
        : base.assetDataVarianceNotes,
    signedAppraisalFileName: payload.signedAppraisalFileName ?? null,
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
}): Promise<EvaluatorSubmission> {
  const existing = await fetchEvaluatorSubmission(input.taskId);
  if (existing) return existing;
  const draft = createEvaluatorDraft(input);
  const saved = await saveEvaluatorSubmission(draft);
  if (!saved) {
    throw new Error("تعذّر حفظ مسودة التقييم — تحقق من الاتصال وحاول مجدداً.");
  }
  return saved;
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

  await saveEvaluatorSubmission({
    ...current,
    status: "draft",
    updatedAtUtc: new Date().toISOString(),
  });

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
