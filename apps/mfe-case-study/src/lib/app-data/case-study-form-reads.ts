import {
  getCaseStudyForm,
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
