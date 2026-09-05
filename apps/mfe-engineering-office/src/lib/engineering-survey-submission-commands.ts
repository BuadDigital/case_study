import { notifyTasksChanged } from "@case-study/mfe/lib/app-data/tasks-storage";
import {
  dispatchWorkflowSubmitted,
  ENGINEERING_SURVEY_ACCEPTED_EVENT,
  ENGINEERING_SURVEY_RETURNED_EVENT,
  ENGINEERING_SURVEY_SUBMITTED_EVENT,
} from "@platform/app-shared/app-data/party-workflow-events";
import {
  getCachedPartySubmission,
  persistPartySubmissionPayload,
  acceptPartySubmission,
  reopenPartySubmission,
  submitPartySubmission,
  type PartyWorkMutationResult,
} from "@platform/app-shared/app-data/party-submission-api";
import {
  createEngineeringSurveyDraft,
  type EngineeringSurveySubmission,
} from "./engineering-survey-data";
import {
  dtoToSubmission,
  loadEngineeringSurveySubmission,
  notifyChanged,
  submissionToPayload,
} from "./engineering-survey-submission-model";
import { fetchEngineeringSurveySubmission } from "./engineering-survey-submission-reads";
import {
  awaitEngineeringSurveyDraftWrites,
  enqueueEngineeringSurveyDraftWrite,
} from "./engineering-survey-draft-write-queue";

export async function saveEngineeringSurveySubmission(
  submission: EngineeringSurveySubmission,
): Promise<EngineeringSurveySubmission> {
  if (!submission.taskId) {
    throw new Error("معرّف المهمة مطلوب لحفظ الرفع المساحي");
  }
  const existingDto = getCachedPartySubmission(submission.taskId);
  const payload: Record<string, unknown> = {
    ...(existingDto?.payload ?? {}),
    ...submissionToPayload(submission),
    updatedAtUtc: new Date().toISOString(),
  };
  const saved = await persistPartySubmissionPayload(submission.taskId, payload);
  if (!saved.ok) throw new Error(saved.error);
  notifyChanged();
  const next = dtoToSubmission(saved.data);
  if (!next) throw new Error("تعذّر قراءة مسودة الرفع بعد الحفظ");
  return next;
}

export async function getOrCreateEngineeringSurveyDraft(input: {
  taskId: string;
  propertyId: string;
  poNumber: string;
}): Promise<EngineeringSurveySubmission> {
  const existing = await fetchEngineeringSurveySubmission(input.taskId, {
    persistFixes: true,
  });
  if (existing) return existing;
  const draft = createEngineeringSurveyDraft(input);
  return saveEngineeringSurveySubmission(draft);
}

export { awaitEngineeringSurveyDraftWrites } from "./engineering-survey-draft-write-queue";

/** Serialised per task — see engineering-survey-draft-write-queue.ts. */
export function updateEngineeringSurveyDraft(
  taskId: string,
  patch: EngineeringSurveyDraftPatch,
): Promise<EngineeringSurveySubmission | null> {
  return enqueueEngineeringSurveyDraftWrite(taskId, () =>
    writeEngineeringSurveyDraft(taskId, patch),
  );
}

export type EngineeringSurveyDraftPatch = Parameters<
  typeof writeEngineeringSurveyDraft
>[1];

async function writeEngineeringSurveyDraft(
  taskId: string,
  patch: Partial<
    Pick<
      EngineeringSurveySubmission,
      | "latitude"
      | "longitude"
      | "surveyReportFileName"
      | "siteLetterFileName"
      | "siteConfirmed"
      | "declarationPhoneSatisfied"
      | "checklist"
      | "returnNote"
      | "deedMatchesNature"
      | "onSiteAreaSqm"
      | "northBoundary"
      | "northBoundaryLengthM"
      | "southBoundary"
      | "southBoundaryLengthM"
      | "eastBoundary"
      | "eastBoundaryLengthM"
      | "westBoundary"
      | "westBoundaryLengthM"
      | "natureOnSiteAreaSqm"
      | "natureNorthBoundary"
      | "natureNorthBoundaryLengthM"
      | "natureSouthBoundary"
      | "natureSouthBoundaryLengthM"
      | "natureEastBoundary"
      | "natureEastBoundaryLengthM"
      | "natureWestBoundary"
      | "natureWestBoundaryLengthM"
      | "surveyNotes"
      | "transactionNote"
    >
  >,
): Promise<EngineeringSurveySubmission | null> {
  const current = loadEngineeringSurveySubmission(taskId);
  if (!current || current.status === "submitted") return current;

  const next: EngineeringSurveySubmission = {
    ...current,
    ...patch,
    checklist: patch.checklist ?? current.checklist,
    status: current.status === "reopened" ? "reopened" : "draft",
    updatedAtUtc: new Date().toISOString(),
  };
  return saveEngineeringSurveySubmission(next);
}

export async function submitEngineeringSurveySubmission(
  taskId: string,
  idempotencyKey?: string,
): Promise<PartyWorkMutationResult<EngineeringSurveySubmission>> {
  // A debounced field write may still be in flight; submit must build on it.
  await awaitEngineeringSurveyDraftWrites(taskId);
  const current = loadEngineeringSurveySubmission(taskId);
  if (!current) {
    return { ok: false, error: "لا توجد مسودة للإرسال" };
  }
  if (current.status === "submitted") {
    return { ok: true, data: current };
  }

  try {
    await saveEngineeringSurveySubmission({
      ...current,
      status: "draft",
      updatedAtUtc: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "تعذّر حفظ المسودة قبل الإرسال",
    };
  }

  const submitted = await submitPartySubmission(taskId, idempotencyKey);
  if (!submitted.ok) return { ok: false, error: submitted.error };
  notifyChanged();
  dispatchWorkflowSubmitted(ENGINEERING_SURVEY_SUBMITTED_EVENT);
  notifyTasksChanged();
  const data = dtoToSubmission(submitted.data);
  if (!data) {
    return { ok: false, error: "تعذّر قراءة بيانات الإرسال" };
  }
  return { ok: true, data };
}

export async function reopenEngineeringSurveySubmission(
  taskId: string,
  returnNote: string,
): Promise<PartyWorkMutationResult<EngineeringSurveySubmission>> {
  const reopened = await reopenPartySubmission(taskId, returnNote);
  if (!reopened.ok) return { ok: false, error: reopened.error };
  notifyChanged();
  notifyTasksChanged();
  dispatchWorkflowSubmitted(ENGINEERING_SURVEY_RETURNED_EVENT);
  const data = dtoToSubmission(reopened.data);
  if (!data) {
    return { ok: false, error: "تعذّر قراءة بيانات إعادة الفتح" };
  }
  return { ok: true, data };
}

/** Specialist acceptance — accrues engineering-office fee from the pricing table. */
export async function acceptEngineeringSurveySubmission(
  taskId: string,
): Promise<PartyWorkMutationResult<EngineeringSurveySubmission>> {
  const accepted = await acceptPartySubmission(taskId);
  if (!accepted.ok) return { ok: false, error: accepted.error };
  notifyChanged();
  notifyTasksChanged();
  dispatchWorkflowSubmitted(ENGINEERING_SURVEY_ACCEPTED_EVENT);
  const data = dtoToSubmission(accepted.data);
  if (!data) {
    return { ok: false, error: "تعذّر قراءة بيانات القبول" };
  }
  return { ok: true, data };
}
