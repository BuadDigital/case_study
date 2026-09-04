import {
  listCourtVisitFees,
  listOperationsTasks,
  listOperationsTasksPage,
  type CourtVisitFeeReportRowDto,
  type OperationsTaskListQuery,
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

/** A query whose result may replace the offline cache: assignee scope only. */
function isCacheableOpsTaskQuery(query?: OperationsTaskQuery): boolean {
  if (!query) return true;
  return (
    !query.status &&
    !query.scope &&
    !query.type &&
    !query.activeOnly &&
    !query.excludeFailurePaused &&
    !query.q?.trim()
  );
}

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
    // Only the assignee-scoped list is a faithful offline cache — a narrowed
    // list (status / scope / type / search) must not overwrite it.
    if (userId && isCacheableOpsTaskQuery(query)) {
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

export type OperationsTasksPage = {
  rows: OperationsTask[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** One server page of operations tasks — pagination-contract §3. */
export async function loadOperationsTasksPage(
  query: OperationsTaskListQuery,
): Promise<OperationsTasksPage> {
  const config = workOrdersApiConfig();
  if (!config) throw new Error(resolveApiError("auth", undefined, "تعذّر تحميل المهام"));
  const result = await listOperationsTasksPage(config, query);
  if (!result.ok) {
    throw new Error(
      result.message ??
        resolveApiError(result.kind, undefined, "تعذّر تحميل المهام"),
    );
  }
  return {
    rows: result.data.items,
    totalCount: result.data.totalCount,
    page: result.data.page,
    pageSize: result.data.pageSize,
    totalPages: result.data.totalPages,
  };
}
