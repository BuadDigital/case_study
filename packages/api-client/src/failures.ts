/**
 * Failures API — property failures (obstructions) persisted in PostgreSQL.
 */
import { parseFieldErrorsFromResponse } from "./field-errors";
import { getApiBase } from "./api-base";
import { withIdempotencyKey } from "./idempotency-key";
import { repositoryFetch as fetch } from "./write-repository";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";
import { fetchListPage, type PagedResultDto } from "./pagination";

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

function headers(token: string, idempotencyKey?: string): HeadersInit {
  const base = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  return idempotencyKey ? withIdempotencyKey(base, idempotencyKey) : base;
}

/** Allowed `sort` keys — pagination-contract §5. Unknown keys fall back to `updated`. */
export type FailureListSort = "updated" | "created" | "po" | "deed";

/** `GET /api/failures` query — pagination-contract §5. */
export type FailureListQuery = {
  /** 1-based page; presence switches the endpoint to the paged envelope. */
  page?: number;
  pageSize?: number;
  sort?: FailureListSort;
  dir?: "asc" | "desc";
  /** Free text over `PoNumber`, `DeedNumber`, `Title`, `Specialist`. */
  q?: string;
  /**
   * CSV of `internal` | `review` | `approved` | `returned` | `suspended` |
   * `resolved`. Unrecognised tokens are dropped; an all-unknown list applies no
   * filter, so a typo never narrows the queue to nothing.
   */
  status?: string | readonly string[];
  poNumber?: string;
  problemTypeId?: string;
};

/** The filter set without the page window. */
export type FailureListFilters = Omit<FailureListQuery, "page" | "pageSize">;

function failureListParams(query?: FailureListQuery) {
  return {
    page: query?.page,
    pageSize: query?.pageSize,
    sort: query?.sort,
    dir: query?.dir,
    q: query?.q,
    status: query?.status,
    poNumber: query?.poNumber,
    problemTypeId: query?.problemTypeId,
  };
}

/**
 * One server page of the failures queue — pagination-contract §5. The actor's
 * visible PO set is resolved inside the query, so `totalCount` is theirs.
 */
export async function listFailuresPage(
  config: FailuresApiConfig,
  query?: FailureListQuery,
): Promise<ApiOk<PagedResultDto<FailureRecordDto>> | ApiErr> {
  return fetchListPage<FailureRecordDto>(
    { ...config, baseUrl: config.baseUrl ?? getApiBase() },
    "/api/failures",
    failureListParams(query),
  );
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
  idempotencyKey?: string,
): Promise<
  | ApiOk<FailureRecordDto>
  | (ApiErr & { errors?: Record<string, string> })
> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: headers(config.token, idempotencyKey),
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
  idempotencyKey?: string,
): Promise<
  | ApiOk<FailureRecordDto>
  | (ApiErr & { errors?: Record<string, string> })
> {
  return postFailureAction(config, "/api/failures", request, idempotencyKey);
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
