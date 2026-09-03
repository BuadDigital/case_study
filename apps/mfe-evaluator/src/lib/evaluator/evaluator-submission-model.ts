import {
  getCachedPartySubmission,
  payloadFromDto,
} from "@platform/app-shared/app-data/party-submission-api";
import { dispatchPartySubmissionChanged } from "@platform/app-shared/app-data/party-submission-changed-event";
import { basisOfValueLabelArForAssignment } from "@platform/app-shared/app-data/assignment-valuation-defaults";
import {
  createEvaluatorDraft,
  normalizeReportChoices,
  normalizeReportWorkers,
  seedReportChoicesFromAssignment,
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

export function notifyEvaluatorSubmissionChanged(): void {
  dispatchPartySubmissionChanged(EVALUATOR_SUBMISSION_CHANGED_EVENT);
}

export function dtoToSubmission(
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

export function submissionPayload(
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
