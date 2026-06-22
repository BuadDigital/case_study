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
    return { ok: true, data: (await res.json()) as PartyTaskSubmissionDto };
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
    return { ok: true, data: (await res.json()) as PartyTaskSubmissionDto };
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
    return { ok: true, data: (await res.json()) as PartyTaskSubmissionDto };
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
    return { ok: true, data: (await res.json()) as PartyTaskSubmissionDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function prefetchPartyTaskSubmissions(
  config: WorkOrdersApiConfig,
  taskIds: string[],
): Promise<void> {
  await Promise.all(
    taskIds.map(async (taskId) => {
      await getPartyTaskSubmission(config, taskId);
    }),
  );
}
