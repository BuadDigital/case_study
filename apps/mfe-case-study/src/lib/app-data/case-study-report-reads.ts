import {
  CASE_STUDY_REPORT_BATCH_MAX_IDS,
  getCaseStudyReport,
  getCaseStudyReportsBatch,
  getPartyCaseStudyReport,
} from "@platform/api-client";
import {
  apiErrorMessage,
  resolveApiError,
  requireWorkOrdersApiConfig,
  workOrdersApiConfig,
} from "../work-orders-api-config";
import { caseStudyReportDtoToDraft, type CaseStudyReportDraft } from "./case-study-report-model";

export async function loadCaseStudyReportDraft(
  taskId: string,
): Promise<CaseStudyReportDraft | null> {
  const config = requireWorkOrdersApiConfig();
  const result = await getCaseStudyReport(config, taskId);
  if (result.ok) return caseStudyReportDtoToDraft(result.data);
  if (result.kind === "not_found") return null;
  throw new Error(
    resolveApiError(result.kind, result.errors, "تعذّر تحميل مسودة دراسة الحالة"),
  );
}

/** React Query / form loader — surfaces API failures; 404 means no draft yet. */
export async function loadCaseStudyReportDraftOrThrow(
  taskId: string,
): Promise<CaseStudyReportDraft | null> {
  const config = workOrdersApiConfig();
  if (!config) throw new Error(apiErrorMessage("auth"));
  const result = await getCaseStudyReport(config, taskId);
  if (result.ok) return caseStudyReportDtoToDraft(result.data);
  if (result.kind === "not_found") return null;
  throw new Error(
    apiErrorMessage(result.kind, "تعذّر تحميل تقرير دراسة الحالة"),
  );
}

export async function loadPartyCaseStudyReportDraft(
  childTaskId: string,
): Promise<CaseStudyReportDraft | null> {
  const config = requireWorkOrdersApiConfig();
  const result = await getPartyCaseStudyReport(config, childTaskId);
  if (result.ok) return caseStudyReportDtoToDraft(result.data);
  if (result.kind === "not_found") return null;
  throw new Error(
    resolveApiError(result.kind, result.errors, "تعذّر تحميل مسودة دراسة الحالة"),
  );
}

/** A parent's own draft plus its children's party drafts, as one batch row. */
export type CaseStudyReportDraftsForParent = {
  parent: CaseStudyReportDraft;
  /** Keyed by child workflow-task id (lower-case). */
  partyByChildTaskId: Map<string, CaseStudyReportDraft>;
};

/** Keyed by parent workflow-task id (lower-case). */
export type CaseStudyReportDraftsByParent = Map<string, CaseStudyReportDraftsForParent>;

/**
 * One `GET /api/case-study-reports/batch` per `CASE_STUDY_REPORT_BATCH_MAX_IDS` parents
 * — the queue's replacement for `1 + N` single-item reads per row. A parent the
 * viewer may not read (or that no longer exists) is simply absent from the map,
 * the same "not found" the single-item loaders answer with `null`.
 */
export async function loadCaseStudyReportDraftsForParents(
  parentTaskIds: readonly string[],
): Promise<CaseStudyReportDraftsByParent> {
  const ids = [...new Set(parentTaskIds.map((id) => id.trim()).filter(Boolean))];
  const result: CaseStudyReportDraftsByParent = new Map();
  if (ids.length === 0) return result;

  const config = requireWorkOrdersApiConfig();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CASE_STUDY_REPORT_BATCH_MAX_IDS) {
    chunks.push(ids.slice(i, i + CASE_STUDY_REPORT_BATCH_MAX_IDS));
  }
  const responses = await Promise.all(
    chunks.map((chunk) => getCaseStudyReportsBatch(config, chunk)),
  );

  for (const response of responses) {
    if (!response.ok) {
      throw new Error(
        resolveApiError(
          response.kind,
          response.errors,
          "تعذّر تحميل مسودات دراسة الحالة",
        ),
      );
    }
    for (const [parentId, item] of Object.entries(
      response.data.byParentTaskId,
    )) {
      const partyByChildTaskId = new Map<string, CaseStudyReportDraft>();
      for (const [childId, dto] of Object.entries(item.partyContributionsByChildTaskId)) {
        partyByChildTaskId.set(childId.toLowerCase(), caseStudyReportDtoToDraft(dto));
      }
      result.set(parentId.toLowerCase(), {
        parent: caseStudyReportDtoToDraft(item.parent),
        partyByChildTaskId,
      });
    }
  }
  return result;
}

export async function loadPartyCaseStudyReportDraftOrThrow(
  childTaskId: string,
): Promise<CaseStudyReportDraft | null> {
  const config = workOrdersApiConfig();
  if (!config) throw new Error(apiErrorMessage("auth"));
  const result = await getPartyCaseStudyReport(config, childTaskId);
  if (result.ok) return caseStudyReportDtoToDraft(result.data);
  if (result.kind === "not_found") return null;
  throw new Error(
    apiErrorMessage(result.kind, "تعذّر تحميل إجابات دراسة الحالة"),
  );
}
