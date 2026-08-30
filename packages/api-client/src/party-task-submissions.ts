/**
 * Party task submissions API — persists party work (survey, appraisal, gov review, coordination, field inspection).
 * GET/PUT /api/party-task-submissions/{taskId}; POST .../submit completes the workflow child task; POST .../reopen (engineering, appraisal, field-inspection).
 */
import { parseFieldErrorsFromResponse } from "./field-errors";
import { getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

export type PartyTaskSubmissionDto = {
  id?: string;
  taskId: string;
  kind: string;
  status: string;
  propertyId?: string;
  poNumber?: string;
  payload: Record<string, unknown>;
  returnNote?: string;
  submittedAtUtc?: string;
  acceptedAtUtc?: string;
  submittedByUserId?: string;
  submittedByName?: string;
  acceptedByUserId?: string;
  acceptedByName?: string;
  reopenedByUserId?: string;
  reopenedByName?: string;
  updatedAtUtc: string;
  /** Engineering-survey / property-appraisal: sibling field-inspection completed (server). */
  fieldInspectionCompleted?: boolean | null;
  /** Property-appraisal: sibling inspection package specialist-accepted (server). */
  fieldInspectionAccepted?: boolean | null;
};

export type SavePartyTaskSubmissionRequest = {
  payload: Record<string, unknown>;
};

async function parseSaveFailure(
  res: Response,
): Promise<ApiErr & { errors?: Record<string, string> }> {
  if (res.status === 403) {
    const errors = await parseFieldErrorsFromResponse(res);
    return { ok: false, kind: "forbidden", errors, message: errors._ };
  }
  if (res.status === 400) {
    const errors = await parseFieldErrorsFromResponse(res);
    return { ok: false, kind: "validation", errors };
  }
  return { ok: false, kind: "server" };
}

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
    id: (row.id ?? row.Id ?? undefined) as string | undefined,
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
    acceptedAtUtc: (row.acceptedAtUtc ?? row.AcceptedAtUtc ?? undefined) as
      | string
      | undefined,
    submittedByUserId: (row.submittedByUserId ?? row.SubmittedByUserId ?? undefined) as
      | string
      | undefined,
    submittedByName: (row.submittedByName ?? row.SubmittedByName ?? undefined) as
      | string
      | undefined,
    acceptedByUserId: (row.acceptedByUserId ?? row.AcceptedByUserId ?? undefined) as
      | string
      | undefined,
    acceptedByName: (row.acceptedByName ?? row.AcceptedByName ?? undefined) as
      | string
      | undefined,
    reopenedByUserId: (row.reopenedByUserId ?? row.ReopenedByUserId ?? undefined) as
      | string
      | undefined,
    reopenedByName: (row.reopenedByName ?? row.ReopenedByName ?? undefined) as
      | string
      | undefined,
    updatedAtUtc: String(row.updatedAtUtc ?? row.UpdatedAtUtc ?? ""),
    fieldInspectionCompleted: (() => {
      const raw = row.fieldInspectionCompleted ?? row.FieldInspectionCompleted;
      if (raw === true || raw === false) return raw;
      return undefined;
    })(),
    fieldInspectionAccepted: (() => {
      const raw = row.fieldInspectionAccepted ?? row.FieldInspectionAccepted;
      if (raw === true || raw === false) return raw;
      return undefined;
    })(),
  };
}

/** Unsaved GET placeholders have no row id — treat them as "not started". */
export function isPersistedPartyTaskSubmission(
  dto: PartyTaskSubmissionDto | null | undefined,
): dto is PartyTaskSubmissionDto {
  return Boolean(dto?.id?.trim());
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
    if (res.status === 403 || res.status === 400) return parseSaveFailure(res);
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
    if (res.status === 403 || res.status === 400) return parseSaveFailure(res);
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
    if (res.status === 403 || res.status === 400) return parseSaveFailure(res);
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: normalizeSubmissionDto(await res.json()) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** Specialist accepts party outputs (survey fee accrual; inspection → Enfaz package). */
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
    if (res.status === 403 || res.status === 400) return parseSaveFailure(res);
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
