import {
  approveEvaluatorRecallApi,
  rejectEvaluatorRecallApi,
  requestEvaluatorRecallApi,
} from "@platform/api-client";
import {
  apiErrorMessage,
  resolveApiError,
} from "@platform/app-shared/app-data/work-orders-api-config";
import { prototypeModulesApiConfig } from "./modules-api-config";
import {
  fetchPartySubmission,
  reopenPartySubmission,
} from "./party-submission-api";
import {
  cachePartyTaskRecall,
  getPartyTaskRecall,
  mapPartyTaskRecallDto,
  notifyPartyTaskRecallChanged,
  notifyPartyTaskRecallRequested,
  partyTaskRecallReturnNote,
  type PartyTaskRecallResult,
} from "./party-task-recall-model";

export async function requestPartyTaskRecall(input: {
  taskId: string;
  poNumber: string;
  propertyId: string;
  reason?: string;
}): Promise<PartyTaskRecallResult> {
  const existing = getPartyTaskRecall(input.taskId);
  if (existing?.status === "pending") {
    return { ok: true, request: existing };
  }

  const config = prototypeModulesApiConfig();
  if (!config) {
    return { ok: false, error: apiErrorMessage("auth") };
  }

  const result = await requestEvaluatorRecallApi(config, input);
  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(
        result.kind,
        result.errors,
        "تعذّر إرسال طلب الاسترجاع",
      ),
    };
  }

  const mapped = mapPartyTaskRecallDto(result.data);
  cachePartyTaskRecall(mapped);
  notifyPartyTaskRecallChanged();
  notifyPartyTaskRecallRequested();
  return { ok: true, request: mapped };
}

/**
 * Approve and reopen are two calls against two services, so an approved recall
 * can be left with the work still submitted. Re-running this is safe and is how
 * a half-applied approval recovers.
 */
async function reopenForApprovedRecall(
  taskId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let submission;
  try {
    submission = await fetchPartySubmission(taskId);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.message
          ? error.message
          : "وُوفّق على الاسترجاع لكن تعذّر التحقق من حالة الإرسال",
    };
  }

  if (!submission || submission.status !== "submitted") return { ok: true };

  const reopened = await reopenPartySubmission(
    taskId,
    partyTaskRecallReturnNote(reason),
  );
  if (!reopened.ok) {
    return {
      ok: false,
      error:
        reopened.error ||
        "وُوفّق على الاسترجاع لكن تعذّر إعادة فتح المسودة على الخادم",
    };
  }
  return { ok: true };
}

export async function approvePartyTaskRecall(
  taskId: string,
): Promise<PartyTaskRecallResult> {
  const current = getPartyTaskRecall(taskId);
  if (!current) {
    return { ok: false, error: "لا يوجد طلب استرجاع لهذه المهمة" };
  }

  if (current.status === "rejected") return { ok: true, request: current };

  if (current.status === "approved") {
    const retried = await reopenForApprovedRecall(taskId, current.reason);
    if (!retried.ok) return { ok: false, error: retried.error };
    notifyPartyTaskRecallChanged();
    return { ok: true, request: current };
  }

  const config = prototypeModulesApiConfig();
  if (!config) {
    return { ok: false, error: apiErrorMessage("auth") };
  }

  const result = await approveEvaluatorRecallApi(config, taskId);
  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(result.kind, undefined, "تعذّر الموافقة على الاسترجاع"),
    };
  }

  const mapped = mapPartyTaskRecallDto(result.data);
  cachePartyTaskRecall(mapped);
  const reopened = await reopenForApprovedRecall(taskId, current.reason);
  if (!reopened.ok) {
    return { ok: false, error: reopened.error };
  }
  notifyPartyTaskRecallChanged();
  return { ok: true, request: mapped };
}

export async function rejectPartyTaskRecall(
  taskId: string,
  specialistNote?: string,
): Promise<PartyTaskRecallResult> {
  const current = getPartyTaskRecall(taskId);
  if (current?.status !== "pending") {
    if (current) return { ok: true, request: current };
    return { ok: false, error: "لا يوجد طلب استرجاع لهذه المهمة" };
  }

  const config = prototypeModulesApiConfig();
  if (!config) {
    return { ok: false, error: apiErrorMessage("auth") };
  }

  const result = await rejectEvaluatorRecallApi(
    config,
    taskId,
    specialistNote,
  );
  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(result.kind, undefined, "تعذّر رفض طلب الاسترجاع"),
    };
  }

  const mapped = mapPartyTaskRecallDto(result.data);
  cachePartyTaskRecall(mapped);
  notifyPartyTaskRecallChanged();
  return { ok: true, request: mapped };
}
