import {
  approveCaseStudyReport,
  issueCaseStudyReport,
  reopenCaseStudyReport,
  saveCaseStudyReport,
  savePartyCaseStudyReport,
} from "@platform/api-client";
import {
  apiErrorMessage,
  notifyWorkOrdersChanged,
  resolveApiError,
  workOrdersApiConfig,
} from "@platform/app-shared/app-data/work-orders-api-config";
import { notifyTasksChanged } from "./tasks-model";
import { syncEvaluatorChecklistFromPartyCaseStudy } from "../evaluator-bridge";
import {
  caseStudyReportDraftToDto,
  caseStudyReportDtoToDraft,
  notifyPartyCaseStudyReportChanged,
  type CaseStudyReportDraft,
  type SaveCaseStudyReportDraftResult,
} from "@platform/app-shared/app-data/case-study-report-model";
import {
  caseStudyReopenReasonError,
  parseCaseStudyIssueErrors,
  reopenNeedsEnfazConfirmation,
  type CaseStudyIssueErrors,
} from "./case-study-report-issue-errors";

export async function saveCaseStudyReportDraft(
  draft: CaseStudyReportDraft,
  idempotencyKey?: string,
): Promise<SaveCaseStudyReportDraftResult> {
  const config = workOrdersApiConfig();
  if (!config) {
    return { ok: false, error: apiErrorMessage("auth") };
  }
  const payload = {
    ...draft,
    savedAtUtc: new Date().toISOString(),
  };
  const result = await saveCaseStudyReport(
    config,
    draft.taskId,
    caseStudyReportDraftToDto(payload),
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
  if (payload.status === "issued") {
    notifyWorkOrdersChanged();
    notifyTasksChanged();
  }
  return { ok: true, draft: caseStudyReportDtoToDraft(result.data) };
}

type IssueCaseStudyReportDraftResult =
  | { ok: true; draft: CaseStudyReportDraft }
  | ({ ok: false; error: string } & CaseStudyIssueErrors);

/**
 * Issue the report (`POST .../issue`) — the server re-checks completeness and the deed-nature match
 * from the body. A refusal keeps the field errors split for the form: the missing question keys, the
 * deed-nature flags and the first message.
 */
export async function issueCaseStudyReportDraft(
  draft: CaseStudyReportDraft,
): Promise<IssueCaseStudyReportDraftResult> {
  const config = workOrdersApiConfig();
  if (!config) {
    return {
      ok: false,
      error: apiErrorMessage("auth"),
      ...parseCaseStudyIssueErrors(undefined),
    };
  }
  const payload = { ...draft, savedAtUtc: new Date().toISOString() };
  const result = await issueCaseStudyReport(
    config,
    draft.taskId,
    caseStudyReportDraftToDto(payload),
  );
  if (!result.ok) {
    const errors = "errors" in result ? result.errors : undefined;
    return {
      ok: false,
      error: resolveApiError(
        result.kind,
        errors,
        "تعذّر إصدار تقرير دراسة الحالة",
        "message" in result ? result.message : undefined,
      ),
      ...parseCaseStudyIssueErrors(errors),
    };
  }
  notifyWorkOrdersChanged();
  notifyTasksChanged();
  notifyPartyCaseStudyReportChanged(draft.taskId);
  return { ok: true, draft: caseStudyReportDtoToDraft(result.data) };
}

export type ReopenCaseStudyReportDraftResult =
  | {
      ok: true;
      draft: CaseStudyReportDraft;
      appraiserSubmitted: boolean;
      enfazHandoverCleared: boolean;
    }
  | {
      ok: false;
      error: string;
      /** The property is handed over to Enfaz — retry with `clearEnfazHandover` after confirming. */
      needsEnfazConfirmation: boolean;
    };

/**
 * Review approves the study sent to it (`POST .../approve-study`, Omar 2026-11-08) — the study data is
 * locked for everyone from then on. Returns null on success, else the Arabic refusal.
 */
export async function approveCaseStudyReportDraft(taskId: string): Promise<string | null> {
  const config = workOrdersApiConfig();
  if (!config) return apiErrorMessage("auth");
  const result = await approveCaseStudyReport(config, taskId);
  if (!result.ok) {
    return resolveApiError(
      result.kind,
      "errors" in result ? result.errors : undefined,
      "تعذّر اعتماد الدراسة",
      "message" in result ? result.message : undefined,
    );
  }
  notifyWorkOrdersChanged();
  notifyTasksChanged();
  return null;
}

/**
 * Reopen the sent study (`POST .../reopen`): the study takes it back, or review returns it to the study
 * (Omar 2026-11-08); the reason is required server-side too.
 */
export async function reopenCaseStudyReportDraft(
  taskId: string,
  reason: string,
  clearEnfazHandover: boolean,
): Promise<ReopenCaseStudyReportDraftResult> {
  const trimmed = reason.trim();
  const reasonError = caseStudyReopenReasonError(trimmed);
  if (reasonError) {
    return { ok: false, error: reasonError, needsEnfazConfirmation: false };
  }
  const config = workOrdersApiConfig();
  if (!config) {
    return {
      ok: false,
      error: apiErrorMessage("auth"),
      needsEnfazConfirmation: false,
    };
  }
  const result = await reopenCaseStudyReport(config, taskId, {
    reason: trimmed,
    clearEnfazHandover,
  });
  if (!result.ok) {
    const errors = "errors" in result ? result.errors : undefined;
    return {
      ok: false,
      error: resolveApiError(
        result.kind,
        errors,
        "تعذّر إعادة فتح تقرير دراسة الحالة",
        "message" in result ? result.message : undefined,
      ),
      needsEnfazConfirmation: reopenNeedsEnfazConfirmation(errors),
    };
  }
  notifyWorkOrdersChanged();
  notifyTasksChanged();
  notifyPartyCaseStudyReportChanged(taskId);
  return {
    ok: true,
    draft: caseStudyReportDtoToDraft(result.data.report),
    appraiserSubmitted: result.data.appraiserSubmitted,
    enfazHandoverCleared: result.data.enfazHandoverCleared,
  };
}

export async function savePartyCaseStudyReportDraft(
  draft: CaseStudyReportDraft,
): Promise<SaveCaseStudyReportDraftResult> {
  const config = workOrdersApiConfig();
  if (!config) {
    return { ok: false, error: apiErrorMessage("auth") };
  }
  const payload = {
    ...draft,
    savedAtUtc: new Date().toISOString(),
  };
  const result = await savePartyCaseStudyReport(
    config,
    draft.taskId,
    caseStudyReportDraftToDto(payload),
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
  const saved = caseStudyReportDtoToDraft(result.data);
  notifyPartyCaseStudyReportChanged(draft.taskId);
  void syncEvaluatorChecklistFromPartyCaseStudy(draft.taskId, {
    overwriteLinked: true,
  });
  return { ok: true, draft: saved };
}
