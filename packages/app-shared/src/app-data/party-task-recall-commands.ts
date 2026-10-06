import {
  decideEvaluatorRecallApi,
  requestEvaluatorRecallApi,
  type EvaluatorRecallDecision,
} from "@platform/api-client";
import {
  apiErrorMessage,
  firstApiFieldError,
  resolveApiError,
} from "@platform/app-shared/app-data/work-orders-api-config";
import { prototypeModulesApiConfig } from "./modules-api-config";
import { fetchPartySubmission } from "./party-submission-api";
import {
  cachePartyTaskRecall,
  getPartyTaskRecall,
  mapPartyTaskRecallDto,
  notifyPartyTaskRecallChanged,
  notifyPartyTaskRecallRequested,
  type PartyTaskRecallResult,
} from "./party-task-recall-model";

/** Shown when the server refuses a decision with no message of its own (the appraiser already deposited). */
export const RECALL_DECISION_REFUSED_FALLBACK =
  "تعذّر تنفيذ القرار — إن كان المقيّم قد أودع تقريره فلا يُستردّ الآن، وتُتاح نسخة جديدة في مرحلة لاحقة";

export const RECALL_DECISION_FORBIDDEN =
  "القرار في طلبات الاسترجاع للأخصائي وحده";

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
 * The specialist's decision, ONE call: the server reopens the appraiser's package first
 * (idempotent) and then records the approval — so a failure leaves the request pending and the
 * same call is the safe retry (also for a row whose package is already reopened).
 */
async function decidePartyTaskRecall(
  taskId: string,
  decision: EvaluatorRecallDecision,
  note?: string,
): Promise<PartyTaskRecallResult> {
  const current = getPartyTaskRecall(taskId);
  if (!current) {
    return { ok: false, error: "لا يوجد طلب استرجاع لهذه المهمة" };
  }
  // Already decided — nothing to do.
  if (current.status !== "pending") return { ok: true, request: current };

  const config = prototypeModulesApiConfig();
  if (!config) {
    return { ok: false, error: apiErrorMessage("auth") };
  }

  const result = await decideEvaluatorRecallApi(config, taskId, decision, note);
  if (!result.ok) {
    if (result.kind === "forbidden") {
      return {
        ok: false,
        error: result.message?.trim() || RECALL_DECISION_FORBIDDEN,
      };
    }
    // A refused decision (the appraiser already deposited) carries its own Arabic text.
    if (result.kind === "validation") {
      return {
        ok: false,
        error:
          result.message?.trim() ||
          firstApiFieldError(result.errors) ||
          RECALL_DECISION_REFUSED_FALLBACK,
      };
    }
    const fallback =
      decision === "approve"
        ? "تعذّرت الموافقة على الاسترجاع"
        : "تعذّر رفض طلب الاسترجاع";
    return {
      ok: false,
      error: resolveApiError(result.kind, result.errors, fallback, result.message),
    };
  }

  const mapped = mapPartyTaskRecallDto(result.data);
  cachePartyTaskRecall(mapped);
  if (decision === "approve") {
    // The server reopened the package — refresh the cached copy the queues read synchronously.
    await fetchPartySubmission(taskId).catch(() => null);
  }
  notifyPartyTaskRecallChanged();
  return { ok: true, request: mapped };
}

export function approvePartyTaskRecall(
  taskId: string,
): Promise<PartyTaskRecallResult> {
  return decidePartyTaskRecall(taskId, "approve");
}

export function rejectPartyTaskRecall(
  taskId: string,
  specialistNote?: string,
): Promise<PartyTaskRecallResult> {
  return decidePartyTaskRecall(taskId, "reject", specialistNote);
}
