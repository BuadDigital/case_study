import { notifyTasksChanged } from "@case-study/mfe/lib/prototype/tasks-storage";
import { dispatchPartySubmissionChanged } from "@platform/app-shared/prototype/party-submission-changed-event";
import { dispatchWorkflowSubmitted, ENGINEERING_SURVEY_SUBMITTED_EVENT } from "@platform/app-shared/prototype/party-workflow-events";
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
import {
  createEngineeringSurveyDraft,
  type EngineeringSurveyChecklistRow,
  type EngineeringSurveySubmission,
  type EngineeringSurveySubmissionStatus,
} from "./engineering-survey-data";
import {
  jeddahDefaultCoords,
  shouldUseJeddahDefaultCoords,
} from "./jeddah-default-coords";

export const ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT =
  "engineering-survey-submission-changed";

function notifyChanged(): void {
  dispatchPartySubmissionChanged(ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT);
}

function dtoToSubmission(
  dto: ReturnType<typeof getCachedPartySubmission>,
): EngineeringSurveySubmission | null {
  if (!dto) return null;
  const payload = payloadFromDto<EngineeringSurveySubmission>(dto);
  return {
    ...payload,
    taskId: dto.taskId,
    propertyId: payload.propertyId ?? dto.propertyId ?? "",
    poNumber: payload.poNumber ?? dto.poNumber ?? "",
    status: (dto.status as EngineeringSurveySubmissionStatus) ?? payload.status,
    returnNote: dto.returnNote ?? payload.returnNote,
    submittedAtUtc: dto.submittedAtUtc ?? payload.submittedAtUtc,
    updatedAtUtc: dto.updatedAtUtc ?? payload.updatedAtUtc,
  };
}

function submissionToPayload(
  submission: EngineeringSurveySubmission,
): Record<string, unknown> {
  return { ...submission };
}

/** Sync read from in-memory cache (for queue badges/filters). */
export function loadEngineeringSurveySubmission(
  taskId: string,
): EngineeringSurveySubmission | null {
  return dtoToSubmission(getCachedPartySubmission(taskId));
}

export async function fetchEngineeringSurveySubmission(
  taskId: string,
): Promise<EngineeringSurveySubmission | null> {
  const dto = await fetchPartySubmission(taskId);
  let sub = dtoToSubmission(dto);
  if (!sub) return null;

  if (!sub.checklist?.length) {
    sub = createEngineeringSurveyDraft({
      taskId: sub.taskId,
      propertyId: sub.propertyId,
      poNumber: sub.poNumber,
    });
  }
  if (
    sub.status !== "submitted" &&
    shouldUseJeddahDefaultCoords(sub.latitude, sub.longitude)
  ) {
    const defaults = jeddahDefaultCoords();
    sub = { ...sub, ...defaults };
    await saveEngineeringSurveySubmission(sub);
  }
  return sub;
}

/** Load from API; creates draft when missing (for advisory panels). */
export async function loadEngineeringSurveySubmissionAsync(input: {
  taskId: string;
  propertyId?: string;
  poNumber?: string;
}): Promise<EngineeringSurveySubmission | null> {
  const cached = loadEngineeringSurveySubmission(input.taskId);
  if (cached) return cached;
  const fetched = await fetchEngineeringSurveySubmission(input.taskId);
  if (fetched) return fetched;
  if (!input.propertyId || !input.poNumber) return null;
  return getOrCreateEngineeringSurveyDraft({
    taskId: input.taskId,
    propertyId: input.propertyId,
    poNumber: input.poNumber,
  });
}

export async function saveEngineeringSurveySubmission(
  submission: EngineeringSurveySubmission,
): Promise<EngineeringSurveySubmission | null> {
  if (!submission.taskId) return null;
  const existingDto = getCachedPartySubmission(submission.taskId);
  const payload: Record<string, unknown> = {
    ...(existingDto?.payload ?? {}),
    ...submissionToPayload(submission),
    updatedAtUtc: new Date().toISOString(),
  };
  const dto = await persistPartySubmissionPayload(submission.taskId, payload);
  if (!dto) return null;
  notifyChanged();
  return dtoToSubmission(dto);
}

export async function getOrCreateEngineeringSurveyDraft(input: {
  taskId: string;
  propertyId: string;
  poNumber: string;
}): Promise<EngineeringSurveySubmission> {
  const existing = await fetchEngineeringSurveySubmission(input.taskId);
  if (existing) return existing;
  const draft = createEngineeringSurveyDraft(input);
  const saved = await saveEngineeringSurveySubmission(draft);
  return saved ?? draft;
}

export async function updateEngineeringSurveyDraft(
  taskId: string,
  patch: Partial<
    Pick<
      EngineeringSurveySubmission,
      | "latitude"
      | "longitude"
      | "surveyReportFileName"
      | "siteLetterFileName"
      | "siteConfirmed"
      | "checklist"
      | "returnNote"
      | "onSiteAreaSqm"
      | "northBoundary"
      | "northBoundaryLengthM"
      | "southBoundary"
      | "southBoundaryLengthM"
      | "eastBoundary"
      | "eastBoundaryLengthM"
      | "westBoundary"
      | "westBoundaryLengthM"
      | "surveyNotes"
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
): Promise<EngineeringSurveySubmission | null> {
  const current = loadEngineeringSurveySubmission(taskId);
  if (!current || current.status === "submitted") return current;

  await saveEngineeringSurveySubmission({
    ...current,
    status: "draft",
    updatedAtUtc: new Date().toISOString(),
  });

  const dto = await submitPartySubmission(taskId);
  if (!dto) return loadEngineeringSurveySubmission(taskId);
  notifyChanged();
  dispatchWorkflowSubmitted(ENGINEERING_SURVEY_SUBMITTED_EVENT);
  notifyTasksChanged();
  return dtoToSubmission(dto);
}

export async function reopenEngineeringSurveySubmission(
  taskId: string,
  returnNote: string,
): Promise<EngineeringSurveySubmission | null> {
  const dto = await reopenPartySubmission(taskId, returnNote);
  if (!dto) return null;
  notifyChanged();
  notifyTasksChanged();
  return dtoToSubmission(dto);
}

export async function prefetchEngineeringSurveySubmissions(
  taskIds: string[],
): Promise<void> {
  await prefetchPartySubmissionsForTasks(taskIds);
}

export function isVisibleInEngineeringSurveyQueue(
  taskId: string,
  taskStatus: string,
): boolean {
  if (taskStatus === "completed") return false;
  const sub = loadEngineeringSurveySubmission(taskId);
  return sub?.status !== "submitted";
}

export function patchChecklistRow(
  rows: EngineeringSurveyChecklistRow[],
  index: number,
  patch: Partial<EngineeringSurveyChecklistRow>,
): EngineeringSurveyChecklistRow[] {
  return rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
}

export function engineeringSurveyStatusLabel(
  status: EngineeringSurveySubmissionStatus,
): string {
  if (status === "submitted") return "مُرسَل";
  if (status === "reopened") return "مُعاد";
  return "قيد العمل";
}

/** Seed cache without API (tests / migration). */
export function seedEngineeringSurveySubmissionCache(
  submission: EngineeringSurveySubmission,
): void {
  setCachedPartySubmission(
    {
      taskId: submission.taskId,
      kind: "engineering-survey",
      status: submission.status,
      propertyId: submission.propertyId,
      poNumber: submission.poNumber,
      payload: submissionToPayload(submission),
      returnNote: submission.returnNote,
      submittedAtUtc: submission.submittedAtUtc,
      updatedAtUtc: submission.updatedAtUtc,
    },
    submission.taskId,
  );
}
