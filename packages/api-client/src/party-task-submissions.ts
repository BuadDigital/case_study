/**
 * Party task submissions API — persists party work (survey, appraisal, gov review, coordination, field inspection).
 * GET/PUT /api/party-task-submissions/{taskId}; POST .../submit completes the workflow child task; POST .../reopen (engineering, appraisal, field-inspection).
 */
import { parseFieldErrorsFromResponse } from "./field-errors";
import { getApiBase } from "./index";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

export type PartyTaskSubmissionDto = {
  taskId: string;
  kind: string;
  status: string;
  propertyId?: string;
  poNumber?: string;
  payload: Record<string, unknown>;
  returnNote?: string;
  submittedAtUtc?: string;
  updatedAtUtc: string;
};

export type SavePartyTaskSubmissionRequest = {
  payload: Record<string, unknown>;
};

export type ReopenPartyTaskSubmissionRequest = {
  returnNote: string;
};

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function normalizeSubmissionDto(raw: unknown): PartyTaskSubmissionDto {
  const row = raw as Record<string, unknown>;
  return {
    taskId: String(row.taskId ?? row.TaskId ?? ""),
    kind: String(row.kind ?? row.Kind ?? ""),
    status: String(row.status ?? row.Status ?? "draft"),
    propertyId: (row.propertyId ?? row.PropertyId ?? undefined) as string | undefined,
    poNumber: (row.poNumber ?? row.PoNumber ?? undefined) as string | undefined,
    payload: (row.payload ?? row.Payload ?? {}) as Record<string, unknown>,
    returnNote: (row.returnNote ?? row.ReturnNote ?? undefined) as string | undefined,
    submittedAtUtc: (row.submittedAtUtc ?? row.SubmittedAtUtc ?? undefined) as
      | string
      | undefined,
    updatedAtUtc: String(row.updatedAtUtc ?? row.UpdatedAtUtc ?? ""),
  };
}

export async function getPartyTaskSubmission(
  config: WorkOrdersApiConfig,
  taskId: string,
): Promise<ApiOk<PartyTaskSubmissionDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/party-task-submissions/${taskId}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: normalizeSubmissionDto(await res.json()) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function savePartyTaskSubmission(
  config: WorkOrdersApiConfig,
  taskId: string,
  payload: Record<string, unknown>,
): Promise<
  | ApiOk<PartyTaskSubmissionDto>
  | (ApiErr & { errors?: Record<string, string> })
> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/party-task-submissions/${taskId}`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify({ payload } satisfies SavePartyTaskSubmissionRequest),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "validation", errors };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: normalizeSubmissionDto(await res.json()) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function submitPartyTaskSubmission(
  config: WorkOrdersApiConfig,
  taskId: string,
): Promise<
  | ApiOk<PartyTaskSubmissionDto>
  | (ApiErr & { errors?: Record<string, string> })
> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/party-task-submissions/${taskId}/submit`, {
      method: "POST",
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "validation", errors };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: normalizeSubmissionDto(await res.json()) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function reopenPartyTaskSubmission(
  config: WorkOrdersApiConfig,
  taskId: string,
  returnNote: string,
): Promise<
  | ApiOk<PartyTaskSubmissionDto>
  | (ApiErr & { errors?: Record<string, string> })
> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/party-task-submissions/${taskId}/reopen`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify({ returnNote } satisfies ReopenPartyTaskSubmissionRequest),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "validation", errors };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: normalizeSubmissionDto(await res.json()) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** Specialist accepts engineering-survey outputs — accrues office fee from pricing table. */
export async function acceptPartyTaskSubmission(
  config: WorkOrdersApiConfig,
  taskId: string,
): Promise<
  | ApiOk<PartyTaskSubmissionDto>
  | (ApiErr & { errors?: Record<string, string> })
> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/party-task-submissions/${taskId}/accept`, {
      method: "POST",
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "validation", errors };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: normalizeSubmissionDto(await res.json()) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function listPartyTaskSubmissions(
  config: WorkOrdersApiConfig,
  workflowTaskIds: string[],
): Promise<ApiOk<PartyTaskSubmissionDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  const ids = workflowTaskIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return { ok: true, data: [] };

  const params = new URLSearchParams({
    workflowTaskIds: ids.join(","),
  });

  try {
    const res = await fetch(`${base}/api/party-task-submissions?${params}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as unknown[];
    return {
      ok: true,
      data: Array.isArray(raw) ? raw.map(normalizeSubmissionDto) : [],
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}
