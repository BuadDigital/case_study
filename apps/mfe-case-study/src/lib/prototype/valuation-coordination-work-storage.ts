import { notifyTasksChanged } from "./tasks-storage";
import { dispatchPartySubmissionChanged } from "@platform/app-shared/prototype/party-submission-changed-event";
import {
  dispatchWorkflowSubmitted,
  VALUATION_COORDINATION_SUBMITTED_EVENT,
} from "@platform/app-shared/prototype/party-workflow-events";
import {
  fetchPartySubmission,
  getCachedPartySubmission,
  payloadFromDto,
  persistPartySubmissionPayload,
  prefetchPartySubmissionsForTasks,
  setCachedPartySubmission,
  submitPartySubmission,
  type PartyWorkMutationResult,
} from "@platform/app-shared/prototype/party-submission-api";
import {
  createValuationCoordinationDraft,
  type ValuationCoordinationSubmission,
} from "./valuation-coordination-work-data";

export const VALUATION_COORDINATION_SUBMISSION_CHANGED_EVENT =
  "valuation-coordination-submission-changed";

function notifyChanged(): void {
  dispatchPartySubmissionChanged(
    VALUATION_COORDINATION_SUBMISSION_CHANGED_EVENT,
  );
}

function dtoToSubmission(
  dto: ReturnType<typeof getCachedPartySubmission>,
): ValuationCoordinationSubmission | null {
  if (!dto) return null;
  const payload = payloadFromDto<ValuationCoordinationSubmission>(dto);
  return {
    ...payload,
    taskId: dto.taskId,
    propertyId: payload.propertyId ?? dto.propertyId ?? "",
    poNumber: payload.poNumber ?? dto.poNumber ?? "",
    status:
      payload.status ??
      (dto.status as ValuationCoordinationSubmission["status"]),
    submittedAtUtc: dto.submittedAtUtc ?? payload.submittedAtUtc ?? null,
    updatedAtUtc: dto.updatedAtUtc ?? payload.updatedAtUtc,
  };
}

export function loadValuationCoordinationSubmission(
  taskId: string,
): ValuationCoordinationSubmission | null {
  return dtoToSubmission(getCachedPartySubmission(taskId));
}

export async function fetchValuationCoordinationSubmission(
  taskId: string,
): Promise<ValuationCoordinationSubmission | null> {
  const dto = await fetchPartySubmission(taskId);
  return dtoToSubmission(dto);
}

export async function saveValuationCoordinationSubmission(
  submission: ValuationCoordinationSubmission,
): Promise<ValuationCoordinationSubmission> {
  if (!submission.taskId) {
    throw new Error("معرّف المهمة مطلوب لحفظ التنسيق");
  }
  const payload = {
    ...submission,
    updatedAtUtc: new Date().toISOString(),
  };
  const saved = await persistPartySubmissionPayload(submission.taskId, payload);
  if (!saved.ok) throw new Error(saved.error);
  notifyChanged();
  const next = dtoToSubmission(saved.data);
  if (!next) throw new Error("تعذّر قراءة مسودة التنسيق بعد الحفظ");
  return next;
}

export async function getOrCreateValuationCoordinationDraft(input: {
  taskId: string;
  propertyId: string;
  poNumber: string;
  inspectorName?: string;
  appraiserName?: string;
}): Promise<ValuationCoordinationSubmission> {
  const existing = await fetchValuationCoordinationSubmission(input.taskId);
  if (existing) return existing;
  const draft = createValuationCoordinationDraft(input);
  const saved = await saveValuationCoordinationSubmission(draft);
  if (!saved) {
    throw new Error("تعذّر حفظ مسودة التنسيق — تحقق من الاتصال وحاول مجدداً.");
  }
  return saved;
}

export async function updateValuationCoordinationDraft(
  taskId: string,
  patch: Partial<
    Pick<
      ValuationCoordinationSubmission,
      | "receiptConfirmed"
      | "receiptDate"
      | "priority"
      | "coordinationNotes"
      | "inspectorInstructions"
      | "appraiserInstructions"
      | "inspectorName"
      | "appraiserName"
    >
  >,
): Promise<ValuationCoordinationSubmission | null> {
  const current = loadValuationCoordinationSubmission(taskId);
  if (!current || current.status === "submitted") return current;

  const next: ValuationCoordinationSubmission = {
    ...current,
    ...patch,
    status: "draft",
    updatedAtUtc: new Date().toISOString(),
  };
  return saveValuationCoordinationSubmission(next);
}

export async function submitValuationCoordinationSubmission(
  taskId: string,
): Promise<PartyWorkMutationResult<ValuationCoordinationSubmission>> {
  const current = loadValuationCoordinationSubmission(taskId);
  if (!current) {
    return { ok: false, error: "لا توجد مسودة للإرسال" };
  }
  if (current.status === "submitted") {
    return { ok: true, data: current };
  }

  try {
    await saveValuationCoordinationSubmission({
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
  dispatchWorkflowSubmitted(VALUATION_COORDINATION_SUBMITTED_EVENT);
  notifyTasksChanged();
  const data = dtoToSubmission(submitted.data);
  if (!data) {
    return { ok: false, error: "تعذّر قراءة بيانات الإرسال" };
  }
  return { ok: true, data };
}

export async function prefetchValuationCoordinationSubmissions(
  taskIds: string[],
): Promise<void> {
  await prefetchPartySubmissionsForTasks(taskIds);
}

export function seedValuationCoordinationSubmissionCache(
  submission: ValuationCoordinationSubmission,
): void {
  setCachedPartySubmission(
    {
      taskId: submission.taskId,
      kind: "valuation-coordination",
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
