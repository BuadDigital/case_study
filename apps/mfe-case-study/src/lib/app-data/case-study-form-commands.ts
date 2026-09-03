import {
  saveCaseStudyForm,
  savePartyCaseStudyForm,
} from "@platform/api-client";
import {
  apiErrorMessage,
  resolveApiError,
  workOrdersApiConfig,
} from "../work-orders-api-config";
import { notifyWorkOrdersChanged } from "@platform/app-shared/app-data/work-orders-api-config";
import { notifyTasksChanged } from "./tasks-model";
import { syncEvaluatorChecklistFromPartyCaseStudy } from "../evaluator-bridge";
import {
  caseStudyFormDraftToDto,
  caseStudyFormDtoToDraft,
  notifyPartyCaseStudyFormChanged,
  type CaseStudyFormDraft,
  type SaveCaseStudyFormDraftResult,
} from "./case-study-form-model";

export async function saveCaseStudyFormDraft(
  draft: CaseStudyFormDraft,
  idempotencyKey?: string,
): Promise<SaveCaseStudyFormDraftResult> {
  const config = workOrdersApiConfig();
  if (!config) {
    return { ok: false, error: apiErrorMessage("auth") };
  }
  const payload = {
    ...draft,
    savedAtUtc: new Date().toISOString(),
  };
  const result = await saveCaseStudyForm(
    config,
    draft.taskId,
    caseStudyFormDraftToDto(payload),
    idempotencyKey,
  );
  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(
        result.kind,
        "errors" in result ? result.errors : undefined,
        undefined,
        "message" in result ? result.message : undefined,
      ),
    };
  }
  if (payload.status === "submitted") {
    notifyWorkOrdersChanged();
    notifyTasksChanged();
  }
  return { ok: true, draft: caseStudyFormDtoToDraft(result.data) };
}

export async function savePartyCaseStudyFormDraft(
  draft: CaseStudyFormDraft,
): Promise<SaveCaseStudyFormDraftResult> {
  const config = workOrdersApiConfig();
  if (!config) {
    return { ok: false, error: apiErrorMessage("auth") };
  }
  const payload = {
    ...draft,
    savedAtUtc: new Date().toISOString(),
  };
  const result = await savePartyCaseStudyForm(
    config,
    draft.taskId,
    caseStudyFormDraftToDto(payload),
  );
  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(
        result.kind,
        "errors" in result ? result.errors : undefined,
        undefined,
        "message" in result ? result.message : undefined,
      ),
    };
  }
  const saved = caseStudyFormDtoToDraft(result.data);
  notifyPartyCaseStudyFormChanged(draft.taskId);
  void syncEvaluatorChecklistFromPartyCaseStudy(draft.taskId, {
    overwriteLinked: true,
  });
  return { ok: true, draft: saved };
}
