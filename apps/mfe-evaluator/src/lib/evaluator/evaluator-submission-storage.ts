import {
  fetchPartySubmission,
  getCachedPartySubmission,
  payloadFromDto,
  persistPartySubmissionPayload,
  prefetchPartySubmissionsForTasks,
  reopenPartySubmission,
  setCachedPartySubmission,
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
  return {
    ...payload,
    taskId: dto.taskId,
    propertyId: payload.propertyId ?? dto.propertyId ?? "",
    poNumber: payload.poNumber ?? dto.poNumber ?? "",
    status: (dto.status as EvaluatorSubmissionStatus) ?? payload.status,
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

export async function getOrCreateEvaluatorDraft(input: {
  taskId: string;
  propertyId: string;
  poNumber: string;
}): Promise<EvaluatorSubmission> {
  return hydrateEvaluatorSubmission(input);
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

export async function reopenEvaluatorSubmission(
  taskId: string,
): Promise<EvaluatorSubmission | null> {
  const current = loadEvaluatorSubmission(taskId);
  if (!current) return null;
  if (current.status !== "submitted" && current.status !== "completed") {
    return current;
  }
  const next: EvaluatorSubmission = {
    ...current,
    status: "reopened",
    submittedAtUtc: null,
    updatedAtUtc: new Date().toISOString(),
  };
  const saved = await saveEvaluatorSubmission(next);
  if (saved) notifyEvaluatorSubmissionChanged();
  return saved;
}

export async function reopenEvaluatorSubmissionViaApi(
  taskId: string,
  returnNote = "",
): Promise<EvaluatorSubmission | null> {
  const reopened = await reopenPartySubmission(taskId, returnNote);
  if (!reopened.ok) return reopenEvaluatorSubmission(taskId);
  notifyEvaluatorSubmissionChanged();
  notifyTasksChanged();
  return dtoToSubmission(reopened.data);
}

export async function completeEvaluatorSubmission(
  taskId: string,
): Promise<EvaluatorSubmission | null> {
  const current = loadEvaluatorSubmission(taskId);
  if (!current) return null;
  const next: EvaluatorSubmission = {
    ...current,
    status: "completed",
    updatedAtUtc: new Date().toISOString(),
  };
  return saveEvaluatorSubmission(next);
}

export async function prefetchEvaluatorSubmissions(
  taskIds: string[],
): Promise<void> {
  await prefetchPartySubmissionsForTasks(taskIds);
}

export function isVisibleInAppraiserQueue(
  taskId: string,
  taskStatus: string,
): boolean {
  if (taskStatus === "completed") return false;
  const sub = loadEvaluatorSubmission(taskId);
  if (sub?.status === "submitted") return false;
  return true;
}

export function isEvaluatorFormLocked(status: EvaluatorSubmissionStatus): boolean {
  return status === "submitted" || status === "completed";
}

export function seedEvaluatorSubmissionCache(
  submission: EvaluatorSubmission,
): void {
  setCachedPartySubmission(
    {
      taskId: submission.taskId,
      kind: "property-appraisal",
      status: submission.status,
      propertyId: submission.propertyId,
      poNumber: submission.poNumber,
      payload: { ...submission },
      submittedAtUtc: submission.submittedAtUtc ?? undefined,
      updatedAtUtc: submission.updatedAtUtc,
    },
    submission.taskId,
  );
}
