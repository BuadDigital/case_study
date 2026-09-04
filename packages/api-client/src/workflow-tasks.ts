import { getApiBase } from "./api-base";
import { withIdempotencyKey } from "./idempotency-key";
import { repositoryFetch as fetch } from "./write-repository";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";
import {
  fetchAllListPages,
  fetchListPage,
  type ListPageQuery,
  type PagedResultDto,
} from "./pagination";
import { parseFieldErrorsFromResponse } from "./field-errors";

export type TaskDistributionDraftDto = {
  governmentAuditor: boolean;
  governmentAuditorId: string;
  valuationDepartment: boolean;
  operationsCoordinatorId: string;
  inspectorId: string;
  valuatorId: string;
  engineeringOffice: boolean;
  engineeringOfficeId: string;
  caseSpecialist: boolean;
  caseSpecialistId: string;
};

export type WorkflowTaskDto = {
  id: string;
  kind: string;
  poNumber: string;
  propertyId?: string;
  propertyOrdinal: number;
  title: string;
  phase: string;
  assigneeRole: string;
  assigneeName: string;
  assigneeId?: string;
  parentTaskId?: string;
  status: string;
  distribution?: TaskDistributionDraftDto;
  obstructionReason?: string;
  obstructionPriorPhase?: string;
  assignmentType?: string;
  createdAt: string;
  updatedAt: string;
  /** Engineering-survey / property-appraisal: sibling field-inspection completed (server). */
  fieldInspectionCompleted?: boolean | null;
  /** Property-appraisal: sibling inspection package specialist-accepted (server). */
  fieldInspectionAccepted?: boolean | null;
  /** Completed sibling field-inspection task id (server; for loading facts without list visibility). */
  fieldInspectionTaskId?: string | null;
};

export type ConfirmTaskDistributionResponseDto = {
  parent: WorkflowTaskDto | null;
  children: WorkflowTaskDto[];
};

function headers(token: string, idempotencyKey?: string): HeadersInit {
  const base = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  return idempotencyKey ? withIdempotencyKey(base, idempotencyKey) : base;
}

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

/** Allowed `sort` keys — pagination-contract §2. Unknown keys fall back to `created`. */
export type WorkflowTaskListSort =
  | "created"
  | "updated"
  | "po"
  | "poReceived"
  | "poCreated";

/** `GET /api/workflow-tasks` query — pagination-contract §2. */
export type WorkflowTaskListQuery = Omit<ListPageQuery, "sort"> & {
  sort?: WorkflowTaskListSort;
  /** CSV of task kinds; unrecognised tokens are dropped by the server. */
  kind?: string | readonly string[];
  /** CSV of `open` | `completed` | `cancelled` | `blocked`. */
  status?: string | readonly string[];
  /** CSV of `enfath` | `bourse` | `distribution` | `case-study` | `obstruction` | `done`. */
  phase?: string | readonly string[];
  assigneeId?: string;
  assigneeRole?: string;
  poNumber?: string;
  assignmentType?: string;
};

/** Every filter of the list query except the page window. */
export type WorkflowTaskListFilters = Omit<
  WorkflowTaskListQuery,
  "page" | "pageSize"
>;

function workflowTaskListParams(query?: WorkflowTaskListQuery) {
  return {
    page: query?.page,
    pageSize: query?.pageSize,
    sort: query?.sort,
    dir: query?.dir,
    q: query?.q,
    kind: query?.kind,
    status: query?.status,
    phase: query?.phase,
    assigneeId: query?.assigneeId,
    assigneeRole: query?.assigneeRole,
    poNumber: query?.poNumber,
    assignmentType: query?.assignmentType,
  };
}

export async function listWorkflowTasks(
  config: WorkOrdersApiConfig,
  query?: WorkflowTaskListFilters,
): Promise<ApiOk<WorkflowTaskDto[]> | ApiErr> {
  return fetchAllListPages<WorkflowTaskDto>(
    { ...config, baseUrl: config.baseUrl ?? getApiBase() },
    "/api/workflow-tasks",
    { params: workflowTaskListParams(query) },
  );
}

/** One server page of the workflow-task list — filters, sort and paging server-side. */
export async function listWorkflowTasksPage(
  config: WorkOrdersApiConfig,
  query?: WorkflowTaskListQuery,
): Promise<ApiOk<PagedResultDto<WorkflowTaskDto>> | ApiErr> {
  return fetchListPage<WorkflowTaskDto>(
    { ...config, baseUrl: config.baseUrl ?? getApiBase() },
    "/api/workflow-tasks",
    workflowTaskListParams(query),
  );
}

export async function syncWorkflowTasks(
  config: WorkOrdersApiConfig,
): Promise<ApiOk<WorkflowTaskDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/workflow-tasks/sync`, {
      method: "POST",
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await readJson<WorkflowTaskDto[]>(res);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function patchWorkflowTaskDistribution(
  config: WorkOrdersApiConfig,
  taskId: string,
  distribution: TaskDistributionDraftDto,
): Promise<ApiOk<WorkflowTaskDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/workflow-tasks/${taskId}/distribution`,
      {
        method: "PATCH",
        headers: headers(config.token),
        body: JSON.stringify({ distribution }),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await readJson<WorkflowTaskDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function confirmWorkflowTaskDistribution(
  config: WorkOrdersApiConfig,
  taskId: string,
  body: {
    distribution: TaskDistributionDraftDto;
    deedNumber: string;
    assigneeNames?: Record<string, string>;
  },
  idempotencyKey?: string,
): Promise<ApiOk<ConfirmTaskDistributionResponseDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/workflow-tasks/${taskId}/confirm-distribution`,
      {
        method: "POST",
        headers: headers(config.token, idempotencyKey),
        body: JSON.stringify(body),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (res.status === 400) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "validation", errors };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await readJson<ConfirmTaskDistributionResponseDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function redistributeWorkflowTaskParties(
  config: WorkOrdersApiConfig,
  taskId: string,
  body: {
    distribution: TaskDistributionDraftDto;
    assigneeNames?: Record<string, string>;
    reason: string;
  },
  idempotencyKey?: string,
): Promise<ApiOk<WorkflowTaskDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/workflow-tasks/${taskId}/redistribute`,
      {
        method: "POST",
        headers: headers(config.token, idempotencyKey),
        body: JSON.stringify(body),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (res.status === 400) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "validation", errors };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await readJson<WorkflowTaskDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function advanceWorkflowTaskAfterEnfath(
  config: WorkOrdersApiConfig,
  taskId: string,
  body: {
    propertyId: string;
    identifierType: string;
    bourseDataCompleted: boolean;
    deedNumber: string;
  },
): Promise<ApiOk<WorkflowTaskDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/workflow-tasks/${taskId}/advance-after-enfath`,
      {
        method: "POST",
        headers: headers(config.token),
        body: JSON.stringify(body),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await readJson<WorkflowTaskDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function advanceWorkflowTaskAfterBourse(
  config: WorkOrdersApiConfig,
  taskId: string,
  deedNumber: string,
): Promise<ApiOk<WorkflowTaskDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/workflow-tasks/${taskId}/advance-after-bourse`,
      {
        method: "POST",
        headers: headers(config.token),
        body: JSON.stringify({ deedNumber }),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await readJson<WorkflowTaskDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function revertWorkflowTaskPhase(
  config: WorkOrdersApiConfig,
  taskId: string,
  targetPhase: "enfath" | "bourse",
): Promise<ApiOk<WorkflowTaskDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/workflow-tasks/${taskId}/revert-phase`,
      {
        method: "POST",
        headers: headers(config.token),
        body: JSON.stringify({ targetPhase }),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (res.status === 400) {
      return {
        ok: false,
        kind: "validation",
        errors: await parseFieldErrorsFromResponse(res),
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await readJson<WorkflowTaskDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function patchWorkflowTask(
  config: WorkOrdersApiConfig,
  taskId: string,
  body: Record<string, unknown>,
): Promise<ApiOk<WorkflowTaskDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/workflow-tasks/${taskId}`, {
      method: "PATCH",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await readJson<WorkflowTaskDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function reopenCompletedWorkflowTask(
  config: WorkOrdersApiConfig,
  taskId: string,
  reason: string,
): Promise<ApiOk<WorkflowTaskDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/workflow-tasks/${taskId}/reopen-completed`,
      {
        method: "POST",
        headers: headers(config.token),
        body: JSON.stringify({ reason }),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (res.status === 400) {
      return {
        ok: false,
        kind: "validation",
        errors: await parseFieldErrorsFromResponse(res),
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await readJson<WorkflowTaskDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function deleteWorkflowTaskSlot(
  config: WorkOrdersApiConfig,
  taskId: string,
  reason: string,
): Promise<ApiOk<void> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/workflow-tasks/${encodeURIComponent(taskId)}`,
      {
        method: "DELETE",
        headers: headers(config.token),
        body: JSON.stringify({ reason }),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (res.status === 422) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "validation", errors };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function deleteWorkflowTasksForPo(
  config: WorkOrdersApiConfig,
  poNumber: string,
): Promise<ApiOk<void> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/workflow-tasks/by-po/${encodeURIComponent(poNumber)}`,
      {
        method: "DELETE",
        headers: headers(config.token),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function deleteWorkflowTasksForProperty(
  config: WorkOrdersApiConfig,
  poNumber: string,
  propertyId: string,
  expectedPropertyCount = 1,
): Promise<ApiOk<void> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/workflow-tasks/by-po/${encodeURIComponent(poNumber)}/properties/${propertyId}?expectedPropertyCount=${expectedPropertyCount}`,
      {
        method: "DELETE",
        headers: headers(config.token),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, kind: "network" };
  }
}
