import { getPartyTaskSubmission, type PartyTaskSubmissionDto } from "@platform/api-client";
import { resolveApiError, workOrdersApiConfig } from "../work-orders-api-config";
import { fetchGovernmentReviewSubmission } from "./government-review-work-storage";
import { fetchValuationCoordinationSubmission } from "./valuation-coordination-work-storage";
import type { WorkflowTask } from "./tasks-storage";
import type {
  EngineeringSurveyChecklistRow,
  EngineeringSurveySubmissionSnapshot,
  EvaluatorChecklist,
  EvaluatorSubmissionSnapshot,
  GovernmentReviewSubmissionSnapshot,
  ValuationCoordinationSubmissionSnapshot,
} from "./property-detail-party-submission-types";

function parseEvaluatorPayload(
  dto: PartyTaskSubmissionDto,
): EvaluatorSubmissionSnapshot | null {
  const payload = dto.payload ?? {};
  if (typeof payload !== "object" || payload === null) return null;
  const raw = payload as Record<string, unknown>;
  return {
    status: String(raw.status ?? dto.status ?? "draft"),
    evaluatorPrice: String(raw.evaluatorPrice ?? ""),
    evaluatorNotes: String(raw.evaluatorNotes ?? ""),
    reportFileName:
      typeof raw.reportFileName === "string" ? raw.reportFileName : null,
    submittedAtUtc:
      typeof raw.submittedAtUtc === "string"
        ? raw.submittedAtUtc
        : dto.submittedAtUtc ?? null,
    checklist: (raw.checklist ?? {}) as EvaluatorChecklist,
  };
}

export async function loadEvaluatorSubmissionSnapshot(
  taskId: string,
): Promise<EvaluatorSubmissionSnapshot | null> {
  const config = workOrdersApiConfig();
  if (!config || !taskId) return null;

  const result = await getPartyTaskSubmission(config, taskId);
  if (!result.ok) {
    if (result.kind === "not_found") return null;
    throw new Error(
      resolveApiError(result.kind, result.errors, "تعذّر تحميل بيانات التقييم"),
    );
  }
  return parseEvaluatorPayload(result.data);
}

export async function loadEngineeringSurveySubmissionSnapshot(
  taskId: string,
): Promise<EngineeringSurveySubmissionSnapshot | null> {
  const config = workOrdersApiConfig();
  if (!config || !taskId) return null;

  const result = await getPartyTaskSubmission(config, taskId);
  if (!result.ok) {
    if (result.kind === "not_found") return null;
    throw new Error(
      resolveApiError(result.kind, result.errors, "تعذّر تحميل بيانات الرفع المساحي"),
    );
  }

  const payload = result.data.payload ?? {};
  const status =
    (payload.status as EngineeringSurveySubmissionSnapshot["status"] | undefined)
    ?? (result.data.status as EngineeringSurveySubmissionSnapshot["status"])
    ?? "draft";

  return {
    status,
    latitude: String(payload.latitude ?? ""),
    longitude: String(payload.longitude ?? ""),
    surveyReportFileName: String(payload.surveyReportFileName ?? ""),
    siteLetterFileName: String(payload.siteLetterFileName ?? ""),
    siteConfirmed: payload.siteConfirmed === true,
    checklist: Array.isArray(payload.checklist)
      ? (payload.checklist as EngineeringSurveyChecklistRow[])
      : [],
    returnNote:
      typeof payload.returnNote === "string"
        ? payload.returnNote
        : result.data.returnNote,
    onSiteAreaSqm: String(payload.onSiteAreaSqm ?? ""),
    northBoundary: String(payload.northBoundary ?? ""),
    northBoundaryLengthM: String(payload.northBoundaryLengthM ?? ""),
    southBoundary: String(payload.southBoundary ?? ""),
    southBoundaryLengthM: String(payload.southBoundaryLengthM ?? ""),
    eastBoundary: String(payload.eastBoundary ?? ""),
    eastBoundaryLengthM: String(payload.eastBoundaryLengthM ?? ""),
    westBoundary: String(payload.westBoundary ?? ""),
    westBoundaryLengthM: String(payload.westBoundaryLengthM ?? ""),
    surveyNotes: String(payload.surveyNotes ?? ""),
    updatedAtUtc:
      typeof payload.updatedAtUtc === "string"
        ? payload.updatedAtUtc
        : result.data.updatedAtUtc,
    submittedAtUtc:
      typeof payload.submittedAtUtc === "string"
        ? payload.submittedAtUtc
        : result.data.submittedAtUtc,
  };
}

export async function loadGovernmentReviewSubmissionSnapshot(
  child: WorkflowTask,
): Promise<GovernmentReviewSubmissionSnapshot | null> {
  if (!child.propertyId) return null;
  const submission = await fetchGovernmentReviewSubmission(child.id);
  if (!submission) return null;
  return {
    status: submission.status,
    visitStatus: submission.visitStatus,
    visitDate: submission.visitDate,
    courtName: submission.courtName,
    keysStatus: submission.keysStatus,
    keysDescription: submission.keysDescription,
    keyHandedToInspector: submission.keyHandedToInspector,
    accessBlockReason: submission.accessBlockReason,
    reviewNotes: submission.reviewNotes,
    propertyZoneStatus: submission.propertyZoneStatus,
    keysProofFiles: submission.keysProofFiles,
    submittedAtUtc: submission.submittedAtUtc,
    updatedAtUtc: submission.updatedAtUtc,
  };
}

export async function loadValuationCoordinationSubmissionSnapshot(
  child: WorkflowTask,
): Promise<ValuationCoordinationSubmissionSnapshot | null> {
  if (!child.propertyId) return null;
  const submission = await fetchValuationCoordinationSubmission(child.id);
  if (!submission) return null;
  return {
    status: submission.status,
    receiptConfirmed: submission.receiptConfirmed,
    receiptDate: submission.receiptDate,
    inspectorName: submission.inspectorName,
    appraiserName: submission.appraiserName,
    priority: submission.priority,
    coordinationNotes: submission.coordinationNotes,
    inspectorInstructions: submission.inspectorInstructions,
    appraiserInstructions: submission.appraiserInstructions,
    submittedAtUtc: submission.submittedAtUtc,
    updatedAtUtc: submission.updatedAtUtc,
  };
}
