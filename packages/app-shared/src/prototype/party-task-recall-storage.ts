import {
  approveEvaluatorRecallApi,
  getEvaluatorRecallApi,
  listEvaluatorRecallsApi,
  rejectEvaluatorRecallApi,
  requestEvaluatorRecallApi,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "./prototype-modules-api-config";
import { reopenPartySubmission } from "./party-submission-api";

export type PartyTaskRecallStatus = "pending" | "approved" | "rejected";

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

/** @deprecated use PARTY_TASK_RECALL_CHANGED_EVENT */
export const EVALUATOR_RECALL_CHANGED_EVENT = PARTY_TASK_RECALL_CHANGED_EVENT;
/** @deprecated use PARTY_TASK_RECALL_HYDRATED_EVENT */
export const EVALUATOR_RECALL_HYDRATED_EVENT = PARTY_TASK_RECALL_HYDRATED_EVENT;

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

export async function hydratePartyTaskRecalls(options?: {
  force?: boolean;
}): Promise<void> {
  if (!options?.force && recallsHydrated) return;
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    const config = prototypeModulesApiConfig();
    if (!config) return;

    const result = await listEvaluatorRecallsApi(config);
    if (!result.ok) return;

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

export function listPartyTaskRecalls(): PartyTaskRecallRequest[] {
  return [...memoryByTask.values()];
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
  notifyPartyTaskRecallChanged();
}

export async function requestPartyTaskRecall(input: {
  taskId: string;
  poNumber: string;
  propertyId: string;
  reason?: string;
}): Promise<PartyTaskRecallRequest | null> {
  const existing = getPartyTaskRecall(input.taskId);
  if (existing?.status === "pending") return existing;

  const config = prototypeModulesApiConfig();
  if (!config) return null;

  const result = await requestEvaluatorRecallApi(config, input);
  if (!result.ok) return null;

  const mapped = mapDto(result.data);
  memoryByTask.set(input.taskId, mapped);
  notifyPartyTaskRecallChanged();
  return mapped;
}

export async function approvePartyTaskRecall(
  taskId: string,
): Promise<PartyTaskRecallRequest | null> {
  const current = getPartyTaskRecall(taskId);
  if (current?.status !== "pending") return current ?? null;

  const config = prototypeModulesApiConfig();
  if (!config) return null;

  const result = await approveEvaluatorRecallApi(config, taskId);
  if (!result.ok) return null;

  const mapped = mapDto(result.data);
  memoryByTask.set(taskId, mapped);
  await reopenPartySubmission(taskId, current.reason);
  notifyPartyTaskRecallChanged();
  return mapped;
}

export async function rejectPartyTaskRecall(
  taskId: string,
  specialistNote?: string,
): Promise<PartyTaskRecallRequest | null> {
  const current = getPartyTaskRecall(taskId);
  if (current?.status !== "pending") return current ?? null;

  const config = prototypeModulesApiConfig();
  if (!config) return null;

  const result = await rejectEvaluatorRecallApi(
    config,
    taskId,
    specialistNote,
  );
  if (!result.ok) return null;

  const mapped = mapDto(result.data);
  memoryByTask.set(taskId, mapped);
  notifyPartyTaskRecallChanged();
  return mapped;
}
