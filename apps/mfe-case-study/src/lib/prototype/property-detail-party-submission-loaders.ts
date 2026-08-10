import { getPartyTaskSubmission, type PartyTaskSubmissionDto } from "@platform/api-client";
import { resolveApiError, workOrdersApiConfig } from "../work-orders-api-config";
import type {
  EngineeringSurveyChecklistRow,
  EngineeringSurveySubmissionSnapshot,
  EvaluatorChecklist,
  EvaluatorSubmissionSnapshot,
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
    appraisalDate: String(raw.appraisalDate ?? ""),
    valuationMethod: String(raw.valuationMethod ?? ""),
    valueBasis: String(raw.valueBasis ?? ""),
    demandLevel: String(raw.demandLevel ?? ""),
    landValue: String(raw.landValue ?? ""),
    buildingValue: String(raw.buildingValue ?? ""),
    forcedSaleDiscountPct: String(raw.forcedSaleDiscountPct ?? ""),
    searchScopeNotes: String(raw.searchScopeNotes ?? ""),
    planImageFileName:
      typeof raw.planImageFileName === "string" ? raw.planImageFileName : null,
    appraiserAddress: String(raw.appraiserAddress ?? ""),
    appraiserPhone: String(raw.appraiserPhone ?? ""),
    reportIssueDate: String(raw.reportIssueDate ?? ""),
    independenceDeclared: Boolean(raw.independenceDeclared),
    reportWorkers: Array.isArray(raw.reportWorkers)
      ? (raw.reportWorkers as EvaluatorSubmissionSnapshot["reportWorkers"])
      : [],
    assetDataConfirmed: Boolean(raw.assetDataConfirmed),
    assetDataVarianceNotes: String(raw.assetDataVarianceNotes ?? ""),
    signedAppraisalFileName:
      typeof raw.signedAppraisalFileName === "string"
        ? raw.signedAppraisalFileName
        : null,
    acceptedAtUtc: dto.acceptedAtUtc ?? null,
    acceptedByName: dto.acceptedByName ?? null,
    returnNote:
      typeof raw.returnNote === "string"
        ? raw.returnNote
        : dto.returnNote ?? null,
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
    transactionNote: String(payload.transactionNote ?? ""),
    updatedAtUtc:
      typeof payload.updatedAtUtc === "string"
        ? payload.updatedAtUtc
        : result.data.updatedAtUtc,
    submittedAtUtc:
      typeof payload.submittedAtUtc === "string"
        ? payload.submittedAtUtc
        : result.data.submittedAtUtc,
    acceptedAtUtc: result.data.acceptedAtUtc ?? null,
    acceptedByName: result.data.acceptedByName ?? null,
  };
}
