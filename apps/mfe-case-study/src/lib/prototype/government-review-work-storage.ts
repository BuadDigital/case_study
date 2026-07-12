import { notifyTasksChanged } from "./tasks-storage";
import { dispatchPartySubmissionChanged } from "@platform/app-shared/prototype/party-submission-changed-event";
import {
  dispatchWorkflowSubmitted,
  GOVERNMENT_REVIEW_SUBMITTED_EVENT,
} from "@platform/app-shared/prototype/party-workflow-events";
import {
  fetchPartySubmission,
  getCachedPartySubmission,
  payloadFromDto,
  persistPartySubmissionPayload,
  prefetchPartySubmissionsForTasks,
  reopenPartySubmission,
  setCachedPartySubmission,
  submitPartySubmission,
  type PartyWorkMutationResult,
} from "@platform/app-shared/prototype/party-submission-api";
import {
  createGovernmentReviewDraft,
  normalizeGovernmentReviewSubmission,
  type GovernmentReviewSubmission,
} from "./government-review-work-data";

export const GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT =
  "government-review-submission-changed";

function notifyChanged(): void {
  dispatchPartySubmissionChanged(GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT);
}

function dtoToSubmission(
  dto: ReturnType<typeof getCachedPartySubmission>,
): GovernmentReviewSubmission | null {
  if (!dto) return null;
  const payload = payloadFromDto<GovernmentReviewSubmission>(dto);
  const normalized = normalizeGovernmentReviewSubmission(payload);
  return {
    ...normalized,
    taskId: dto.taskId,
    propertyId: normalized.propertyId ?? dto.propertyId ?? "",
    poNumber: normalized.poNumber ?? dto.poNumber ?? "",
    status: normalized.status ?? (dto.status as GovernmentReviewSubmission["status"]),
    returnNote: normalized.returnNote ?? payload.returnNote,
    submittedAtUtc: dto.submittedAtUtc ?? normalized.submittedAtUtc ?? null,
    updatedAtUtc: dto.updatedAtUtc ?? normalized.updatedAtUtc,
  } as GovernmentReviewSubmission;
}

export function loadGovernmentReviewSubmission(
  taskId: string,
): GovernmentReviewSubmission | null {
  return dtoToSubmission(getCachedPartySubmission(taskId));
}

export async function fetchGovernmentReviewSubmission(
  taskId: string,
): Promise<GovernmentReviewSubmission | null> {
  const dto = await fetchPartySubmission(taskId);
  return dtoToSubmission(dto);
}

export async function saveGovernmentReviewSubmission(
  submission: GovernmentReviewSubmission,
): Promise<GovernmentReviewSubmission> {
  if (!submission.taskId) {
    throw new Error("معرّف المهمة مطلوب لحفظ المراجعة");
  }
  const payload = {
    ...submission,
    updatedAtUtc: new Date().toISOString(),
  };
  const saved = await persistPartySubmissionPayload(submission.taskId, payload);
  if (!saved.ok) throw new Error(saved.error);
  notifyChanged();
  const next = dtoToSubmission(saved.data);
  if (!next) throw new Error("تعذّر قراءة مسودة المراجعة بعد الحفظ");
  return next;
}

export async function getOrCreateGovernmentReviewDraft(input: {
  taskId: string;
  propertyId: string;
  poNumber: string;
  courtName?: string;
}): Promise<GovernmentReviewSubmission> {
  const existing = await fetchGovernmentReviewSubmission(input.taskId);
  if (existing) return existing;
  const draft = createGovernmentReviewDraft(input);
  const saved = await saveGovernmentReviewSubmission(draft);
  if (!saved) {
    throw new Error("تعذّر حفظ مسودة المراجعة — تحقق من الاتصال وحاول مجدداً.");
  }
  return saved;
}

export async function updateGovernmentReviewDraft(
  taskId: string,
  patch: Partial<
    Pick<
      GovernmentReviewSubmission,
      | "visitStatus"
      | "visitDate"
      | "courtName"
      | "keysStatus"
      | "keysDescription"
      | "keyHandedToInspector"
      | "accessBlockReason"
      | "reviewNotes"
      | "confirmed"
      | "propertyZoneStatus"
      | "keysProofFiles"
    >
  >,
): Promise<GovernmentReviewSubmission | null> {
  const current = loadGovernmentReviewSubmission(taskId);
  if (!current || current.status === "submitted") return current;

  const next: GovernmentReviewSubmission = {
    ...current,
    ...patch,
    status: current.status === "reopened" ? "reopened" : "draft",
    updatedAtUtc: new Date().toISOString(),
  };
  return saveGovernmentReviewSubmission(next);
}

export async function submitGovernmentReviewSubmission(
  taskId: string,
): Promise<PartyWorkMutationResult<GovernmentReviewSubmission>> {
  const current = loadGovernmentReviewSubmission(taskId);
  if (!current) {
    return { ok: false, error: "لا توجد مسودة للإرسال" };
  }
  if (current.status === "submitted") {
    return { ok: true, data: current };
  }

  try {
    await saveGovernmentReviewSubmission({
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

  const submitted = await submitPartySubmission(taskId);
  if (!submitted.ok) return { ok: false, error: submitted.error };
  notifyChanged();
  dispatchWorkflowSubmitted(GOVERNMENT_REVIEW_SUBMITTED_EVENT);
  notifyTasksChanged();
  const data = dtoToSubmission(submitted.data);
  if (!data) {
    return { ok: false, error: "تعذّر قراءة بيانات الإرسال" };
  }
  return { ok: true, data };
}

export async function reopenGovernmentReviewSubmission(
  taskId: string,
  returnNote: string,
): Promise<PartyWorkMutationResult<GovernmentReviewSubmission>> {
  const reopened = await reopenPartySubmission(taskId, returnNote);
  if (!reopened.ok) return { ok: false, error: reopened.error };
  notifyChanged();
  notifyTasksChanged();
  const data = dtoToSubmission(reopened.data);
  if (!data) {
    return { ok: false, error: "تعذّر قراءة بيانات إعادة الفتح" };
  }
  return { ok: true, data };
}

export async function prefetchGovernmentReviewSubmissions(
  taskIds: string[],
): Promise<void> {
  await prefetchPartySubmissionsForTasks(taskIds);
}

export function seedGovernmentReviewSubmissionCache(
  submission: GovernmentReviewSubmission,
): void {
  setCachedPartySubmission(
    {
      taskId: submission.taskId,
      kind: "government-review",
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
