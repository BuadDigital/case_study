/**
 * Failures API — property failures (تعذرات) persisted in PostgreSQL.
 */
import { parseFieldErrorsFromResponse } from "./field-errors";
import { getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

export type FailuresApiConfig = WorkOrdersApiConfig;

export type FailureRecordDto = {
  id: string;
  poNumber: string;
  propertyId: string;
  deedNumber: string;
  title: string;
  problemTypeId: string;
  severity: string;
  raisedByRole: string;
  internalNote: string;
  finalNote: string;
  resolutionReason: string;
  continueInstructions: string;
  status: string;
  specialist: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateFailureRequest = {
  poNumber: string;
  propertyId: string;
  deedNumber: string;
  problemTypeId: string;
  severity: string;
  raisedByRole?: string;
  title?: string;
  internalNote?: string;
  specialist: string;
};

export type BourseObstructionRequest = {
  poNumber: string;
  propertyId: string;
  deedNumber: string;
  reason: string;
  specialist: string;
};

export type ResolveFailureRequest = {
  resolutionReason: string;
  continueInstructions: string;
};

export type FailureNoteRequest = {
  note: string;
};

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function listFailures(
  config: FailuresApiConfig,
): Promise<ApiOk<FailureRecordDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/failures`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as FailureRecordDto[] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function getPropertyFailure(
  config: FailuresApiConfig,
  poNumber: string,
  propertyId: string,
): Promise<ApiOk<FailureRecordDto | null> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  const params = new URLSearchParams({
    poNumber: poNumber.trim(),
    propertyId: propertyId.trim(),
  });
  try {
    const res = await fetch(`${base}/api/failures/property?${params}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404 || res.status === 204) return { ok: true, data: null };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = (await res.json()) as FailureRecordDto | null;
    return { ok: true, data: data?.id ? data : null };
  } catch {
    return { ok: false, kind: "network" };
  }
}

async function postFailureAction(
  config: FailuresApiConfig,
  path: string,
  body?: unknown,
): Promise<
  | ApiOk<FailureRecordDto>
  | (ApiErr & { errors?: Record<string, string> })
> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: headers(config.token),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "validation", errors };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as FailureRecordDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function createFailure(
  config: FailuresApiConfig,
  request: CreateFailureRequest,
): Promise<
  | ApiOk<FailureRecordDto>
  | (ApiErr & { errors?: Record<string, string> })
> {
  return postFailureAction(config, "/api/failures", request);
}

export async function reportBourseObstruction(
  config: FailuresApiConfig,
  request: BourseObstructionRequest,
): Promise<
  | ApiOk<FailureRecordDto>
  | (ApiErr & { errors?: Record<string, string> })
> {
  return postFailureAction(config, "/api/failures/bourse-obstruction", request);
}

export async function upgradeFailureToInternal(
  config: FailuresApiConfig,
  id: string,
): Promise<ApiOk<FailureRecordDto> | ApiErr> {
  return postFailureAction(config, `/api/failures/${id}/upgrade`);
}

export async function submitFailureForReview(
  config: FailuresApiConfig,
  id: string,
): Promise<ApiOk<FailureRecordDto> | ApiErr> {
  return postFailureAction(config, `/api/failures/${id}/submit`);
}

export async function suspendFailure(
  config: FailuresApiConfig,
  id: string,
  note: string,
): Promise<ApiOk<FailureRecordDto> | ApiErr> {
  return postFailureAction(config, `/api/failures/${id}/suspend`, { note });
}

export async function resolveFailure(
  config: FailuresApiConfig,
  id: string,
  request: ResolveFailureRequest,
): Promise<ApiOk<FailureRecordDto> | ApiErr> {
  return postFailureAction(config, `/api/failures/${id}/resolve`, request);
}

export async function approveFailure(
  config: FailuresApiConfig,
  id: string,
  note: string,
): Promise<ApiOk<FailureRecordDto> | ApiErr> {
  return postFailureAction(config, `/api/failures/${id}/approve`, { note });
}

export async function returnFailure(
  config: FailuresApiConfig,
  id: string,
  note: string,
): Promise<ApiOk<FailureRecordDto> | ApiErr> {
  return postFailureAction(config, `/api/failures/${id}/return`, { note });
}

export async function deleteFailuresForPo(
  config: FailuresApiConfig,
  poNumber: string,
): Promise<ApiOk<void> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/failures/by-po/${encodeURIComponent(poNumber.trim())}`,
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

export function dtoToFailureRecord(dto: FailureRecordDto) {
  return {
    id: dto.id,
    poNumber: dto.poNumber,
    propertyId: dto.propertyId,
    deedNumber: dto.deedNumber,
    title: dto.title,
    problemTypeId: dto.problemTypeId,
    severity: dto.severity,
    raisedByRole: dto.raisedByRole,
    internalNote: dto.internalNote,
    finalNote: dto.finalNote,
    resolutionReason: dto.resolutionReason,
    continueInstructions: dto.continueInstructions,
    status: dto.status,
    specialist: dto.specialist,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}
