import {
  listCourtVisitFees,
  listOperationsTasks,
  type CourtVisitFeeReportRowDto,
} from "@platform/api-client";
import {
  currentOfflineUserId,
  isBrowserOffline,
} from "@platform/app-shared/offline/offline-write";
import {
  readPrefetchedOperationsTasks,
  savePrefetchedOperationsTasks,
} from "@platform/app-shared/offline/prefetch-read";
import {
  resolveApiError,
  workOrdersApiConfig,
} from "../work-orders-api-config";
import {
  filterPrefetchedOpsTasks,
  type OperationsTask,
  type OperationsTaskQuery,
} from "./operations-tasks-model";

export async function loadOperationsTasks(
  query?: OperationsTaskQuery,
): Promise<OperationsTask[]> {
  const config = workOrdersApiConfig();
  const userId = currentOfflineUserId();

  if (!config || isBrowserOffline()) {
    const cached = await readPrefetchedOperationsTasks<OperationsTask>();
    if (!cached) return [];
    return filterPrefetchedOpsTasks(cached, query);
  }

  try {
    const result = await listOperationsTasks(config, query);
    if (!result.ok) {
      const cached = await readPrefetchedOperationsTasks<OperationsTask>();
      if (cached) return filterPrefetchedOpsTasks(cached, query);
      throw new Error(
        result.message ??
          resolveApiError(result.kind, undefined, "تعذّر تحميل المهام"),
      );
    }
    if (userId) {
      await savePrefetchedOperationsTasks(result.data);
    }
    return result.data;
  } catch {
    const cached = await readPrefetchedOperationsTasks<OperationsTask>();
    if (cached) return filterPrefetchedOpsTasks(cached, query);
    throw new Error("تعذّر تحميل المهام");
  }
}

export async function loadCourtVisitFees(query?: {
  creditAssigneeId?: string;
}): Promise<CourtVisitFeeReportRowDto[]> {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const result = await listCourtVisitFees(config, query);
  if (!result.ok) {
    throw new Error(
      result.message ??
        resolveApiError(result.kind, undefined, "تعذّر تحميل أتعاب الزيارة"),
    );
  }
  return result.data;
}
