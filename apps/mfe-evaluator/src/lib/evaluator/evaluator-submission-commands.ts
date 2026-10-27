import {
  fetchPartySubmission,
  persistPartySubmissionPayload,
  submitPartySubmission,
} from "@platform/app-shared/app-data/party-submission-api";
import { createKeyedWriteQueue } from "@platform/app-shared/lib/keyed-write-queue";
import { notifyTasksChanged } from "@platform/app-shared/workflow/task-types";
import {
  dispatchWorkflowSubmitted,
  EVALUATOR_SUBMITTED_EVENT,
} from "@platform/app-shared/app-data/party-workflow-events";
import { loadPartyCaseStudyReportDraft } from "../../lib/case-study-bridge";
import { mergeEvaluatorChecklistFromCaseStudy } from "./evaluator-checklist-case-study-sync";
import {
  createEvaluatorDraft,
  type EvaluatorSubmission,
} from "./evaluator-window-data";
import {
  dtoToSubmission,
  loadEvaluatorSubmission,
  notifyEvaluatorSubmissionChanged,
  submissionPayload,
  type EvaluatorPlanImageMetadata,
  type EvaluatorReportMetadata,
} from "./evaluator-submission-model";

/**
 * Every evaluator draft write reads the cached submission, folds its change in
 * and PUTs the whole payload — so the read-modify-write runs inside this queue,
 * one per task, or an autosave and a banner/submit save in flight together
 * would each erase the other's fields. `saveEvaluatorSubmission` itself is the
 * raw write used inside queued work and is not queued.
 */
const draftWrites = createKeyedWriteQueue();


export function hydrateEvaluatorSubmission(input: {
  taskId: string;
  propertyId: string;
  poNumber: string;
  assignmentType?: string;
}): Promise<EvaluatorSubmission> {
  return draftWrites.enqueue(input.taskId, () => hydrateNow(input));
}

/**
 * Loads (or creates) the appraiser's package for a task; runs inside the task's write queue.
 *
 * How it works: fetches the party submission for `taskId` and maps it (`dtoToSubmission`); if
 * one exists it is returned as is. Otherwise a new draft is built from the input
 * (`createEvaluatorDraft`), saved, and the saved copy is returned.
 *
 * Edge cases: — no report number is reserved here any more (the old
 * `stampReservedReportNumber` opened a valuation request and stamped TQ-… on open); the server
 * stamps PRV-… on the package at report approval. A failed first save throws an Arabic error.
 */
async function hydrateNow(input: {
  taskId: string;
  propertyId: string;
  poNumber: string;
  assignmentType?: string;
}): Promise<EvaluatorSubmission> {
  const existing = dtoToSubmission(
    await fetchPartySubmission(input.taskId),
    input.assignmentType,
  );
  // No report number is reserved here — the server stamps PRV-… on the
  // package when the transaction's official reference is confirmed at approval.
  const draft = existing ?? createEvaluatorDraft(input);
  if (!existing) {
    const saved = await saveEvaluatorSubmission(draft);
    if (!saved) {
      throw new Error("تعذّر حفظ مسودة التقييم — تحقق من الاتصال وحاول مجدداً.");
    }
    return saved;
  }
  return existing;
}

export function syncEvaluatorChecklistFromPartyCaseStudy(
  appraisalTaskId: string,
  options: { overwriteLinked?: boolean } = {},
): Promise<EvaluatorSubmission | null> {
  return draftWrites.enqueue(appraisalTaskId, () =>
    syncChecklistNow(appraisalTaskId, options),
  );
}

async function syncChecklistNow(
  appraisalTaskId: string,
  options: { overwriteLinked?: boolean },
): Promise<EvaluatorSubmission | null> {
  const current = loadEvaluatorSubmission(appraisalTaskId);
  if (!current) return null;
  if (current.status === "submitted" || current.status === "completed") {
    return current;
  }

  const partyDraft = await loadPartyCaseStudyReportDraft(appraisalTaskId);
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

/** Folds a later patch onto an earlier one — later fields win (a checklist patch carries every answer). */
export function mergeEvaluatorDraftPatches(
  earlier: EvaluatorDraftPatch | null,
  later: EvaluatorDraftPatch,
): EvaluatorDraftPatch {
  return earlier ? { ...earlier, ...later } : later;
}

export function updateEvaluatorDraft(
  taskId: string,
  patch: EvaluatorDraftPatch,
  reportMetadata?: EvaluatorReportMetadata | null,
  planImageMetadata?: EvaluatorPlanImageMetadata | null,
): Promise<EvaluatorSubmission | null> {
  return draftWrites.enqueue(taskId, () =>
    updateDraftNow(taskId, patch, reportMetadata, planImageMetadata),
  );
}

async function updateDraftNow(
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

type SubmitEvaluatorResult =
  | { ok: true; submission: EvaluatorSubmission }
  | { ok: false; message: string };

export function submitEvaluatorSubmission(
  taskId: string,
  idempotencyKey?: string,
): Promise<SubmitEvaluatorResult> {
  return draftWrites.enqueue(taskId, () => submitNow(taskId, idempotencyKey));
}

async function submitNow(
  taskId: string,
  idempotencyKey?: string,
): Promise<SubmitEvaluatorResult> {
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

  const submitted = await submitPartySubmission(taskId, idempotencyKey);
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
