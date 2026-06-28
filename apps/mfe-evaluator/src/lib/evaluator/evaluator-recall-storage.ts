import {
  approveEvaluatorRecallApi,
  getEvaluatorRecallApi,
  listEvaluatorRecallsApi,
  rejectEvaluatorRecallApi,
  requestEvaluatorRecallApi,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import { reopenEvaluatorSubmissionViaApi } from "./evaluator-submission-storage";

export type EvaluatorRecallStatus = "pending" | "approved" | "rejected";

export type EvaluatorRecallRequest = {
  taskId: string;
  poNumber: string;
  propertyId: string;
  status: EvaluatorRecallStatus;
  reason: string;
  requestedAtUtc: string;
  resolvedAtUtc: string | null;
  specialistNote: string;
};

const memoryByTask = new Map<string, EvaluatorRecallRequest>();

export const EVALUATOR_RECALL_CHANGED_EVENT = "evaluator-recall-changed";
/** Queue refresh after silent hydrate — must not trigger inbox toasts. */
export const EVALUATOR_RECALL_HYDRATED_EVENT = "evaluator-recall-hydrated";

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
}): EvaluatorRecallRequest {
  return {
    taskId: row.taskId,
    poNumber: row.poNumber,
    propertyId: row.propertyId,
    status: row.status as EvaluatorRecallStatus,
    reason: row.reason,
    requestedAtUtc: row.requestedAtUtc,
    resolvedAtUtc: row.resolvedAtUtc,
    specialistNote: row.specialistNote,
  };
}

export function notifyEvaluatorRecallChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVALUATOR_RECALL_CHANGED_EVENT));
  }
}

export async function hydrateEvaluatorRecalls(options?: {
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
      window.dispatchEvent(new Event(EVALUATOR_RECALL_HYDRATED_EVENT));
    }
  })().finally(() => {
    hydratePromise = null;
  });

  return hydratePromise;
}

export async function hydrateEvaluatorRecallForTask(
  taskId: string,
): Promise<EvaluatorRecallRequest | null> {
  const config = prototypeModulesApiConfig();
  if (!config || !taskId) return getEvaluatorRecall(taskId);

  const result = await getEvaluatorRecallApi(config, taskId);
  if (!result.ok) {
    if (result.kind === "not_found") {
      memoryByTask.delete(taskId);
      return null;
    }
    return getEvaluatorRecall(taskId);
  }

  const mapped = mapDto(result.data);
  memoryByTask.set(taskId, mapped);
  return mapped;
}

export function getEvaluatorRecall(
  taskId: string,
): EvaluatorRecallRequest | null {
  return memoryByTask.get(taskId) ?? null;
}

export function listEvaluatorRecalls(): EvaluatorRecallRequest[] {
  return [...memoryByTask.values()];
}

export function listPendingEvaluatorRecalls(): EvaluatorRecallRequest[] {
  return listEvaluatorRecalls().filter((r) => r.status === "pending");
}

export function recallStatusLabel(status: EvaluatorRecallStatus): string {
  if (status === "pending") return "بانتظار موافقة الأخصائي";
  if (status === "approved") return "وُوفّق على الاستدعاء";
  return "رُفض الاستدعاء";
}

export function clearEvaluatorRecall(taskId: string): void {
  memoryByTask.delete(taskId);
  notifyEvaluatorRecallChanged();
}

export async function requestEvaluatorRecall(input: {
  taskId: string;
  poNumber: string;
  propertyId: string;
  reason?: string;
}): Promise<EvaluatorRecallRequest | null> {
  const existing = getEvaluatorRecall(input.taskId);
  if (existing?.status === "pending") return existing;

  const config = prototypeModulesApiConfig();
  if (!config) return null;

  const result = await requestEvaluatorRecallApi(config, input);
  if (!result.ok) return null;

  const mapped = mapDto(result.data);
  memoryByTask.set(input.taskId, mapped);
  notifyEvaluatorRecallChanged();
  return mapped;
}

export async function approveEvaluatorRecall(
  taskId: string,
): Promise<EvaluatorRecallRequest | null> {
  const current = getEvaluatorRecall(taskId);
  if (current?.status !== "pending") return current;

  const config = prototypeModulesApiConfig();
  if (!config) return null;

  const result = await approveEvaluatorRecallApi(config, taskId);
  if (!result.ok) return null;

  const mapped = mapDto(result.data);
  memoryByTask.set(taskId, mapped);
  void reopenEvaluatorSubmissionViaApi(taskId, current.reason);
  notifyEvaluatorRecallChanged();
  return mapped;
}

export async function rejectEvaluatorRecall(
  taskId: string,
  specialistNote?: string,
): Promise<EvaluatorRecallRequest | null> {
  const current = getEvaluatorRecall(taskId);
  if (current?.status !== "pending") return current;

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
  notifyEvaluatorRecallChanged();
  return mapped;
}
