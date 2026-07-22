import { getApiBase } from "./index";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

export type OperationsTaskLetterRowDto = {
  po: string;
  deed: string;
  owner: string;
  request: string;
  court: string;
  circuit: string;
};

export type OperationsTaskCommentFileDto = {
  name: string;
  size: string;
};

export type OperationsTaskCommentDto = {
  who: "creator" | "assignee" | "system" | string;
  at: string;
  text: string;
  kind?: string;
  files?: OperationsTaskCommentFileDto[];
};

export type OperationsTaskCourtVisitDeedStatementDto = {
  deed: string;
  text: string;
};

export type OperationsTaskCourtVisitContactDto = {
  /** property | deed number */
  scope: string;
  name: string;
  role?: string | null;
  phone?: string | null;
  note?: string | null;
};

export type OperationsTaskCourtVisitResultDto = {
  /** received | other_party | none | other */
  kind: string;
  other?: string | null;
  statement?: string | null;
  perDeed?: OperationsTaskCourtVisitDeedStatementDto[];
  contacts?: OperationsTaskCourtVisitContactDto[];
};

export type OperationsTaskDto = {
  id: string;
  displayId: string;
  type: string;
  title: string;
  description?: string;
  scope: string;
  deeds: string[];
  poNumber?: string;
  assigneeId: string;
  assigneeName: string;
  createdBy: string;
  createdByName: string;
  status: string;
  prevStatus?: string;
  priority: string;
  dueAt: string;
  createdAt: string;
  updatedAt: string;
  reference?: string;
  letterRows: OperationsTaskLetterRowDto[];
  comments: OperationsTaskCommentDto[];
  reminders: { at: string; auto: boolean }[];
  courtVisitResult?: OperationsTaskCourtVisitResultDto | null;
  pauseReason?: string | null;
  pausedAt?: string | null;
  originalAssigneeId?: string | null;
  originalAssigneeName?: string | null;
  creditAssigneeId?: string | null;
  creditAssigneeName?: string | null;
  /** ISO when assignee confirmed receipt; null = بانتظار المنفّذ */
  receiptConfirmedAt?: string | null;
  cancelReason?: string | null;
  linkedEnvelopeId?: string | null;
  visitFeeAmountSar?: number | null;
};

export type CourtVisitFeeReportRowDto = {
  id: string;
  operationsTaskId: string;
  taskDisplayId: string;
  poNumber?: string | null;
  creditAssigneeId: string;
  creditAssigneeName: string;
  amountSar: number;
  status: string;
  createdAtUtc: string;
};

export type CreateOperationsTaskRequest = {
  type: string;
  title: string;
  description?: string;
  scope: string;
  deeds?: string[];
  poNumber?: string;
  assigneeId: string;
  assigneeName?: string;
  priority?: string;
  dueAtUtc?: string;
  letterRows?: OperationsTaskLetterRowDto[];
};

export type PatchOperationsTaskRequest = {
  status?: string;
  priority?: string;
  dueAtUtc?: string;
  title?: string;
  description?: string;
  courtVisitResult?: OperationsTaskCourtVisitResultDto;
  pauseReason?: string;
  cancelReason?: string;
  creditAssigneeId?: string;
  creditAssigneeName?: string;
};

export type ReassignOperationsTaskRequest = {
  assigneeId: string;
  assigneeName?: string;
  dueAtUtc?: string;
  reason: string;
};

export type RemindOperationsTaskRequest = {
  auto?: boolean;
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

function buildQuery(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = value?.trim();
    if (v) q.set(key, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function listOperationsTasks(
  config: WorkOrdersApiConfig,
  query?: { assigneeId?: string; createdBy?: string; status?: string },
): Promise<ApiOk<OperationsTaskDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/operations-tasks${buildQuery({
        assigneeId: query?.assigneeId,
        createdBy: query?.createdBy,
        status: query?.status,
      })}`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await readJson<OperationsTaskDto[]>(res);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function listCourtVisitFees(
  config: WorkOrdersApiConfig,
  query?: { creditAssigneeId?: string },
): Promise<ApiOk<CourtVisitFeeReportRowDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/operations-tasks/court-visit-fees${buildQuery({
        creditAssigneeId: query?.creditAssigneeId,
      })}`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await readJson<CourtVisitFeeReportRowDto[]>(res);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function getOperationsTask(
  config: WorkOrdersApiConfig,
  id: string,
): Promise<ApiOk<OperationsTaskDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/operations-tasks/${encodeURIComponent(id)}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await readJson<OperationsTaskDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function createOperationsTask(
  config: WorkOrdersApiConfig,
  body: CreateOperationsTaskRequest,
): Promise<ApiOk<OperationsTaskDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/operations-tasks`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) {
      const payload = (await readJson<{ error?: string }>(res).catch(
        () => ({ error: undefined }),
      ));
      return { ok: false, kind: "server", message: payload.error };
    }
    return { ok: true, data: await readJson<OperationsTaskDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function patchOperationsTask(
  config: WorkOrdersApiConfig,
  id: string,
  body: PatchOperationsTaskRequest,
): Promise<ApiOk<OperationsTaskDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/operations-tasks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) {
      const payload = (await readJson<{ error?: string }>(res).catch(
        () => ({ error: undefined }),
      ));
      return { ok: false, kind: "server", message: payload.error };
    }
    return { ok: true, data: await readJson<OperationsTaskDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function addOperationsTaskComment(
  config: WorkOrdersApiConfig,
  id: string,
  text: string,
  kind?: string,
  files?: OperationsTaskCommentFileDto[],
): Promise<ApiOk<OperationsTaskDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/operations-tasks/${encodeURIComponent(id)}/comments`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify({ text, kind, files }),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) {
      const payload = (await readJson<{ error?: string }>(res).catch(
        () => ({ error: undefined }),
      ));
      return { ok: false, kind: "server", message: payload.error };
    }
    return { ok: true, data: await readJson<OperationsTaskDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function reassignOperationsTask(
  config: WorkOrdersApiConfig,
  id: string,
  body: ReassignOperationsTaskRequest,
): Promise<ApiOk<OperationsTaskDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/operations-tasks/${encodeURIComponent(id)}/reassign`,
      {
        method: "POST",
        headers: headers(config.token),
        body: JSON.stringify(body),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) {
      const payload = (await readJson<{ error?: string }>(res).catch(
        () => ({ error: undefined }),
      ));
      return { ok: false, kind: "server", message: payload.error };
    }
    return { ok: true, data: await readJson<OperationsTaskDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function remindOperationsTask(
  config: WorkOrdersApiConfig,
  id: string,
  body?: RemindOperationsTaskRequest,
): Promise<ApiOk<OperationsTaskDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/operations-tasks/${encodeURIComponent(id)}/remind`,
      {
        method: "POST",
        headers: headers(config.token),
        body: JSON.stringify(body ?? {}),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) {
      const payload = (await readJson<{ error?: string }>(res).catch(
        () => ({ error: undefined }),
      ));
      return { ok: false, kind: "server", message: payload.error };
    }
    return { ok: true, data: await readJson<OperationsTaskDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}
