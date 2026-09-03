import {
  fetchPartySubmission,
  persistPartySubmissionPayload,
  submitPartySubmission,
} from "@platform/app-shared/app-data/party-submission-api";
import { notifyTasksChanged } from "@platform/app-shared/workflow/task-types";
import {
  dispatchWorkflowSubmitted,
  EVALUATOR_SUBMITTED_EVENT,
} from "@platform/app-shared/app-data/party-workflow-events";
import { loadPartyCaseStudyFormDraft } from "@case-study/mfe/lib/app-data/case-study-form-reads";
import { ensureOpenValuationRequestByProperty } from "@platform/api-client";
import { mergeEvaluatorChecklistFromCaseStudy } from "./evaluator-checklist-case-study-sync";
import {
  createEvaluatorDraft,
  type EvaluatorSubmission,
} from "./evaluator-window-data";
import { reservedValuationReportNumber } from "./valuation-report-number";
import { apiConfig } from "./api-config";
import {
  dtoToSubmission,
  loadEvaluatorSubmission,
  notifyEvaluatorSubmissionChanged,
  submissionPayload,
  type EvaluatorPlanImageMetadata,
  type EvaluatorReportMetadata,
} from "./evaluator-submission-model";

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
    // Best-effort report-number reservation — failure does not block opening the draft, but is no longer silent.
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
  idempotencyKey?: string,
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
