import { dispatchPartySubmissionChanged } from "@platform/app-shared/app-data/party-submission-changed-event";
import {
  getCachedPartySubmission,
  payloadFromDto,
} from "@platform/app-shared/app-data/party-submission-api";
import {
  normalizeEngineeringSurveyChecklist,
  type EngineeringSurveyChecklistRow,
  type EngineeringSurveySubmission,
  type EngineeringSurveySubmissionStatus,
} from "./engineering-survey-data";

export const ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT =
  "engineering-survey-submission-changed";

export function notifyChanged(): void {
  dispatchPartySubmissionChanged(ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT);
}

// Cached DTO keeps a stable reference until refetch — mapping (40 fields + 13 checklist
// rows) used to rerun per task in filtering and per painted row (js-cache-function-results).
const submissionByDto = new WeakMap<
  NonNullable<ReturnType<typeof getCachedPartySubmission>>,
  EngineeringSurveySubmission
>();

export function dtoToSubmission(
  dto: ReturnType<typeof getCachedPartySubmission>,
): EngineeringSurveySubmission | null {
  if (!dto) return null;
  const cached = submissionByDto.get(dto);
  if (cached) return cached;
  const payload = payloadFromDto<EngineeringSurveySubmission>(dto);
  const checklist = normalizeEngineeringSurveyChecklist(payload.checklist);
  const submission: EngineeringSurveySubmission = {
    ...payload,
    taskId: dto.taskId,
    propertyId: payload.propertyId ?? dto.propertyId ?? "",
    poNumber: payload.poNumber ?? dto.poNumber ?? "",
    status: (dto.status as EngineeringSurveySubmissionStatus) ?? payload.status,
    returnNote: dto.returnNote ?? payload.returnNote,
    submittedAtUtc: dto.submittedAtUtc ?? payload.submittedAtUtc,
    acceptedAtUtc: dto.acceptedAtUtc ?? payload.acceptedAtUtc,
    updatedAtUtc: dto.updatedAtUtc ?? payload.updatedAtUtc,
    surveyNotes:
      typeof payload.surveyNotes === "string" ? payload.surveyNotes : "",
    transactionNote:
      typeof payload.transactionNote === "string"
        ? payload.transactionNote
        : "",
    checklist,
    deedMatchesNature: (() => {
      // Legacy payloads may still store a boolean; model is "yes" | "no" | null.
      const raw = payload.deedMatchesNature as unknown;
      if (raw === "yes" || raw === true) return "yes";
      if (raw === "no" || raw === false) return "no";
      return null;
    })(),
    natureOnSiteAreaSqm:
      typeof payload.natureOnSiteAreaSqm === "string"
        ? payload.natureOnSiteAreaSqm
        : "",
    natureNorthBoundary:
      typeof payload.natureNorthBoundary === "string"
        ? payload.natureNorthBoundary
        : "",
    natureNorthBoundaryLengthM:
      typeof payload.natureNorthBoundaryLengthM === "string"
        ? payload.natureNorthBoundaryLengthM
        : "",
    natureSouthBoundary:
      typeof payload.natureSouthBoundary === "string"
        ? payload.natureSouthBoundary
        : "",
    natureSouthBoundaryLengthM:
      typeof payload.natureSouthBoundaryLengthM === "string"
        ? payload.natureSouthBoundaryLengthM
        : "",
    natureEastBoundary:
      typeof payload.natureEastBoundary === "string"
        ? payload.natureEastBoundary
        : "",
    natureEastBoundaryLengthM:
      typeof payload.natureEastBoundaryLengthM === "string"
        ? payload.natureEastBoundaryLengthM
        : "",
    natureWestBoundary:
      typeof payload.natureWestBoundary === "string"
        ? payload.natureWestBoundary
        : "",
    natureWestBoundaryLengthM:
      typeof payload.natureWestBoundaryLengthM === "string"
        ? payload.natureWestBoundaryLengthM
        : "",
    fieldInspectionCompleted:
      typeof dto.fieldInspectionCompleted === "boolean"
        ? dto.fieldInspectionCompleted
        : typeof payload.fieldInspectionCompleted === "boolean"
          ? payload.fieldInspectionCompleted
          : undefined,
  };
  submissionByDto.set(dto, submission);
  return submission;
}

export function submissionToPayload(
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

export function isVisibleInEngineeringSurveyQueue(
  taskId: string,
  taskStatus: string,
  options?: { showCompleted?: boolean },
): boolean {
  if (options?.showCompleted) return true;
  if (taskStatus === "completed") return false;
  const sub = loadEngineeringSurveySubmission(taskId);
  return sub?.status !== "submitted";
}

export function patchChecklistRow(
  rows: EngineeringSurveyChecklistRow[],
  index: number,
  patch: Partial<EngineeringSurveyChecklistRow>,
): EngineeringSurveyChecklistRow[] {
  const next = normalizeEngineeringSurveyChecklist(rows);
  return next.map((row, i) => (i === index ? { ...row, ...patch } : row));
}

export function engineeringSurveyStatusLabel(
  status: EngineeringSurveySubmissionStatus,
): string {
  if (status === "submitted") return "مُرسَل";
  if (status === "reopened") return "معادة للتصحيح";
  return "قيد العمل";
}

/** True when specialist acceptance is stamped on the submission. */
export function isEngineeringSurveyOutputsAccepted(
  submission:
    | Pick<EngineeringSurveySubmission, "acceptedAtUtc">
    | null
    | undefined,
): boolean {
  const stamp = submission?.acceptedAtUtc;
  return typeof stamp === "string" && stamp.trim().length > 0;
}
