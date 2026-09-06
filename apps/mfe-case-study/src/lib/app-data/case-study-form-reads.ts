import {
  CASE_STUDY_FORM_BATCH_MAX_IDS,
  getCaseStudyForm,
  getCaseStudyFormsBatch,
  getPartyCaseStudyForm,
} from "@platform/api-client";
import {
  apiErrorMessage,
  resolveApiError,
  requireWorkOrdersApiConfig,
  workOrdersApiConfig,
} from "../work-orders-api-config";
import { caseStudyFormDtoToDraft, type CaseStudyFormDraft } from "./case-study-form-model";

export async function loadCaseStudyFormDraft(
  taskId: string,
): Promise<CaseStudyFormDraft | null> {
  const config = requireWorkOrdersApiConfig();
  const result = await getCaseStudyForm(config, taskId);
  if (result.ok) return caseStudyFormDtoToDraft(result.data);
  if (result.kind === "not_found") return null;
  throw new Error(
    resolveApiError(result.kind, result.errors, "تعذّر تحميل مسودة دراسة الحالة"),
  );
}

/** React Query / form loader — surfaces API failures; 404 means no draft yet. */
export async function loadCaseStudyFormDraftOrThrow(
  taskId: string,
): Promise<CaseStudyFormDraft | null> {
  const config = workOrdersApiConfig();
  if (!config) throw new Error(apiErrorMessage("auth"));
  const result = await getCaseStudyForm(config, taskId);
  if (result.ok) return caseStudyFormDtoToDraft(result.data);
  if (result.kind === "not_found") return null;
  throw new Error(
    apiErrorMessage(result.kind, "تعذّر تحميل نموذج دراسة الحالة"),
  );
}

export async function loadPartyCaseStudyFormDraft(
  childTaskId: string,
): Promise<CaseStudyFormDraft | null> {
  const config = requireWorkOrdersApiConfig();
  const result = await getPartyCaseStudyForm(config, childTaskId);
  if (result.ok) return caseStudyFormDtoToDraft(result.data);
  if (result.kind === "not_found") return null;
  throw new Error(
    resolveApiError(result.kind, result.errors, "تعذّر تحميل مسودة دراسة الحالة"),
  );
}

/** A parent's own draft plus its children's party drafts, as one batch row. */
export type CaseStudyFormDraftsForParent = {
  parent: CaseStudyFormDraft;
  /** Keyed by child workflow-task id (lower-case). */
  partyByChildTaskId: Map<string, CaseStudyFormDraft>;
};

/** Keyed by parent workflow-task id (lower-case). */
export type CaseStudyFormDraftsByParent = Map<string, CaseStudyFormDraftsForParent>;

/**
 * One `GET /api/case-study-forms/batch` per `CASE_STUDY_FORM_BATCH_MAX_IDS` parents
 * — the queue's replacement for `1 + N` single-item reads per row. A parent the
 * viewer may not read (or that no longer exists) is simply absent from the map,
 * the same "not found" the single-item loaders answer with `null`.
 */
export async function loadCaseStudyFormDraftsForParents(
  parentTaskIds: readonly string[],
): Promise<CaseStudyFormDraftsByParent> {
  const ids = [...new Set(parentTaskIds.map((id) => id.trim()).filter(Boolean))];
  const result: CaseStudyFormDraftsByParent = new Map();
  if (ids.length === 0) return result;

  const config = requireWorkOrdersApiConfig();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CASE_STUDY_FORM_BATCH_MAX_IDS) {
    chunks.push(ids.slice(i, i + CASE_STUDY_FORM_BATCH_MAX_IDS));
  }
  const responses = await Promise.all(
    chunks.map((chunk) => getCaseStudyFormsBatch(config, chunk)),
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
      const partyByChildTaskId = new Map<string, CaseStudyFormDraft>();
      for (const [childId, dto] of Object.entries(item.partyFormsByChildTaskId)) {
        partyByChildTaskId.set(childId.toLowerCase(), caseStudyFormDtoToDraft(dto));
      }
      result.set(parentId.toLowerCase(), {
        parent: caseStudyFormDtoToDraft(item.parent),
        partyByChildTaskId,
      });
    }
  }
  return result;
}

export async function loadPartyCaseStudyFormDraftOrThrow(
  childTaskId: string,
): Promise<CaseStudyFormDraft | null> {
  const config = workOrdersApiConfig();
  if (!config) throw new Error(apiErrorMessage("auth"));
  const result = await getPartyCaseStudyForm(config, childTaskId);
  if (result.ok) return caseStudyFormDtoToDraft(result.data);
  if (result.kind === "not_found") return null;
  throw new Error(
    apiErrorMessage(result.kind, "تعذّر تحميل إجابات دراسة الحالة"),
  );
}
