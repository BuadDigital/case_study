import {
  getEvaluatorRecallApi,
  listEvaluatorRecallsApi,
} from "@platform/api-client";
import { resolveApiError } from "@platform/app-shared/app-data/work-orders-api-config";
import { prototypeModulesApiConfig } from "./modules-api-config";
import {
  cachePartyTaskRecall,
  clearPartyTaskRecall,
  getPartyTaskRecall,
  mapPartyTaskRecallDto,
  replacePartyTaskRecallCache,
  PARTY_TASK_RECALL_HYDRATED_EVENT,
  type PartyTaskRecallRequest,
} from "./party-task-recall-model";

let recallsHydrated = false;
let hydratePromise: Promise<void> | null = null;

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

    replacePartyTaskRecallCache(result.data.map(mapPartyTaskRecallDto));
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
      clearPartyTaskRecall(taskId);
      return null;
    }
    return getPartyTaskRecall(taskId);
  }
  if (!result.data) {
    clearPartyTaskRecall(taskId);
    return null;
  }

  const mapped = mapPartyTaskRecallDto(result.data);
  cachePartyTaskRecall(mapped);
  return mapped;
}
