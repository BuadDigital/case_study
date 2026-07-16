import { getApiBase } from "./index";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";
import { fetchAllListPages } from "./pagination";
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
};

export type ConfirmTaskDistributionResponseDto = {
  parent: WorkflowTaskDto | null;
  children: WorkflowTaskDto[];
};

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function listWorkflowTasks(
  config: WorkOrdersApiConfig,
): Promise<ApiOk<WorkflowTaskDto[]> | ApiErr> {
  return fetchAllListPages<WorkflowTaskDto>(
    { ...config, baseUrl: config.baseUrl ?? getApiBase() },
    "/api/workflow-tasks",
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
): Promise<ApiOk<ConfirmTaskDistributionResponseDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/workflow-tasks/${taskId}/confirm-distribution`,
      {
        method: "POST",
        headers: headers(config.token),
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
      const body = await res.json().catch(() => null);
      const errors =
        body && typeof body === "object" && "errors" in body
          ? (body as { errors?: Record<string, unknown> }).errors
          : undefined;
      return { ok: false, kind: "validation", errors };
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
