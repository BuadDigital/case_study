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

/** Row shape returned by the recall endpoints, before mapping. */
export type PartyTaskRecallRow = {
  taskId: string;
  poNumber: string;
  propertyId: string;
  status: string;
  reason: string;
  specialistNote: string;
  requestedAtUtc: string;
  resolvedAtUtc: string | null;
};

export const PARTY_TASK_RECALL_CHANGED_EVENT = "party-task-recall-changed";
export const PARTY_TASK_RECALL_HYDRATED_EVENT = "party-task-recall-hydrated";

export const PARTY_TASK_RECALL_REQUESTED_EVENT = "party-task-recall-requested";

/**
 * Process-wide recall cache. Both the hydrators (reads) and the request/approve
 * writes (commands) work against this one map, so it lives with the model.
 */
const memoryByTask = new Map<string, PartyTaskRecallRequest>();

export function mapPartyTaskRecallDto(
  row: PartyTaskRecallRow,
): PartyTaskRecallRequest {
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

export function getPartyTaskRecall(
  taskId: string,
): PartyTaskRecallRequest | null {
  return memoryByTask.get(taskId) ?? null;
}

export function cachePartyTaskRecall(request: PartyTaskRecallRequest): void {
  memoryByTask.set(request.taskId, request);
}

export function clearPartyTaskRecall(taskId: string): void {
  memoryByTask.delete(taskId);
}

/** Replaces the whole cache after a full hydrate. */
export function replacePartyTaskRecallCache(
  requests: PartyTaskRecallRequest[],
): void {
  memoryByTask.clear();
  for (const request of requests) memoryByTask.set(request.taskId, request);
}

export function notifyPartyTaskRecallChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PARTY_TASK_RECALL_CHANGED_EVENT));
  }
}

export function notifyPartyTaskRecallRequested(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PARTY_TASK_RECALL_REQUESTED_EVENT));
  }
}

export function partyTaskRecallStatusLabel(
  status: PartyTaskRecallStatus,
): string {
  if (status === "pending") return "بانتظار موافقة الأخصائي";
  if (status === "approved") return "وُوفّق على الاسترجاع";
  return "رُفض الاسترجاع";
}

/**
 * The recall reason is optional for the party, but the server requires a
 * non-empty return note to reopen engineering-survey and field-inspection work.
 */
const DEFAULT_RECALL_RETURN_NOTE = "طلب استرجاع من الطرف";

export function partyTaskRecallReturnNote(reason: string): string {
  return reason.trim() || DEFAULT_RECALL_RETURN_NOTE;
}
