import {
  approveEvaluatorRecallApi,
  getEvaluatorRecallApi,
  listEvaluatorRecallsApi,
  rejectEvaluatorRecallApi,
  requestEvaluatorRecallApi,
} from "@platform/api-client";
import {
  apiErrorMessage,
  resolveApiError,
} from "@platform/app-shared/prototype/work-orders-api-config";
import { prototypeModulesApiConfig } from "./prototype-modules-api-config";
import {
  fetchPartySubmission,
  reopenPartySubmission,
} from "./party-submission-api";

export type PartyTaskRecallStatus = "pending" | "approved" | "rejected";

export type PartyTaskRecallResult =
  | { ok: true; request: PartyTaskRecallRequest }
  | { ok: false; error: string };

export type PartyTaskRecallRequest = {
  taskId: string;
  poNumber: string;
  propertyId: string;
  status: PartyTaskRecallStatus;
  reason: string;
  requestedAtUtc: string;
  resolvedAtUtc: string | null;
  specialistNote: string;
};

const memoryByTask = new Map<string, PartyTaskRecallRequest>();

export const PARTY_TASK_RECALL_CHANGED_EVENT = "party-task-recall-changed";
export const PARTY_TASK_RECALL_HYDRATED_EVENT = "party-task-recall-hydrated";

export const PARTY_TASK_RECALL_REQUESTED_EVENT = "party-task-recall-requested";

let recallsHydrated = false;
let hydratePromise: Promise<void> | null = null;

function mapDto(row: {
  taskId: string;
  poNumber: string;
  propertyId: string;
  status: string;
  reason: string;
  specialistNote: string;
  requestedAtUtc: string;
  resolvedAtUtc: string | null;
}): PartyTaskRecallRequest {
  return {
    taskId: row.taskId,
    poNumber: row.poNumber,
    propertyId: row.propertyId,
    status: row.status as PartyTaskRecallStatus,
    reason: row.reason,
    requestedAtUtc: row.requestedAtUtc,
    resolvedAtUtc: row.resolvedAtUtc,
    specialistNote: row.specialistNote,
  };
}

export function notifyPartyTaskRecallChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PARTY_TASK_RECALL_CHANGED_EVENT));
  }
}

function notifyPartyTaskRecallRequested(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PARTY_TASK_RECALL_REQUESTED_EVENT));
  }
}

export async function hydratePartyTaskRecalls(options?: {
  force?: boolean;
}): Promise<void> {
  if (!options?.force && recallsHydrated) return;
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    const config = prototypeModulesApiConfig();
    if (!config) return;

    const result = await listEvaluatorRecallsApi(config);
    if (!result.ok) {
      throw new Error(
        resolveApiError(result.kind, undefined, "تعذّر تحميل طلبات الاسترجاع"),
      );
    }

    memoryByTask.clear();
    for (const row of result.data) {
      memoryByTask.set(row.taskId, mapDto(row));
    }
    recallsHydrated = true;

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(PARTY_TASK_RECALL_HYDRATED_EVENT));
    }
  })().finally(() => {
    hydratePromise = null;
  });

  return hydratePromise;
}

export async function hydratePartyTaskRecallForTask(
  taskId: string,
): Promise<PartyTaskRecallRequest | null> {
  const config = prototypeModulesApiConfig();
  if (!config || !taskId) return getPartyTaskRecall(taskId);

  const result = await getEvaluatorRecallApi(config, taskId);
  if (!result.ok) {
    if (result.kind === "not_found") {
      memoryByTask.delete(taskId);
      return null;
    }
    return getPartyTaskRecall(taskId);
  }

  const mapped = mapDto(result.data);
  memoryByTask.set(taskId, mapped);
  return mapped;
}

export function getPartyTaskRecall(
  taskId: string,
): PartyTaskRecallRequest | null {
  return memoryByTask.get(taskId) ?? null;
}

export function partyTaskRecallStatusLabel(
  status: PartyTaskRecallStatus,
): string {
  if (status === "pending") return "بانتظار موافقة الأخصائي";
  if (status === "approved") return "وُوفّق على الاسترجاع";
  return "رُفض الاسترجاع";
}

export function clearPartyTaskRecall(taskId: string): void {
  memoryByTask.delete(taskId);
}

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

  const mapped = mapDto(result.data);
  memoryByTask.set(input.taskId, mapped);
  notifyPartyTaskRecallChanged();
  notifyPartyTaskRecallRequested();
  return { ok: true, request: mapped };
}

/**
 * The recall reason is optional for the party, but the server requires a
 * non-empty return note to reopen engineering-survey, field-inspection and
 * government-review work.
 */
const DEFAULT_RECALL_RETURN_NOTE = "طلب استرجاع من الطرف";

export function partyTaskRecallReturnNote(reason: string): string {
  return reason.trim() || DEFAULT_RECALL_RETURN_NOTE;
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

  const mapped = mapDto(result.data);
  memoryByTask.set(taskId, mapped);
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

  const mapped = mapDto(result.data);
  memoryByTask.set(taskId, mapped);
  notifyPartyTaskRecallChanged();
  return { ok: true, request: mapped };
}
