/**
 * Failures API — property failures (obstructions) persisted in PostgreSQL.
 */
import { parseFieldErrorsFromResponse } from "./field-errors";
import { readProblemMessage } from "./parse-json";
import { authHeaders, getApiBase } from "./api-base";
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
  /** The specialist's explanation when escalating to the supervisor. */
  escalationNote?: string;
  finalNote: string;
  resolutionReason: string;
  continueInstructions: string;
  status: string;
  specialist: string;
  createdAt: string;
  updatedAt: string;
  /** Set when the specialist lifted the survey freeze this failure caused (ISO UTC). */
  surveyFreezeLiftedAt?: string | null;
  surveyFreezeLiftReason?: string | null;
  /** The deed's transaction number (PR-… or TMP-…); null when the deed is not found. */
  transactionNumber?: string | null;
  /** Deeds in that transaction (1 for an ordinary property). */
  transactionDeedCount?: number;
  /** The company's case specialist on the deed; null until one is assigned. */
  caseSpecialistName?: string | null;
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

export type ResolveFailureRequest = {
  resolutionReason: string;
  continueInstructions: string;
};

/** Allowed `sort` keys — see the pagination contract. Unknown keys fall back to `updated`. */
export type FailureListSort = "updated" | "created" | "po" | "deed";

/** `GET /api/failures` query — see the pagination contract. */
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
 * One server page of the failures queue — see the pagination contract. The actor's
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
      headers: authHeaders(config.token),
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
      headers: authHeaders(config.token),
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

/**
 * POST one failure action and read its JSON answer.
 *
 * How it works: 401 → `auth`, 400 → `validation` with the field map, 403 → `forbidden` with the
 * server's message, other errors → `server`, a thrown fetch → `network`; success casts the body
 * to `T` (one record by default).
 *
 * Edge cases: `T` was fixed to one record; the final failure answers a list, so it became a type
 * parameter. 403 used to fall into `server`, which hid «التعذّر النهائي عن المعاملة للمشرف فقط»
 * behind a generic error.
 */
async function postFailureAction<T = FailureRecordDto>(
  config: FailuresApiConfig,
  path: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<
  | ApiOk<T>
  | (ApiErr & { errors?: Record<string, string> })
> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: authHeaders(config.token, { idempotencyKey }),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "validation", errors };
    }
    if (res.status === 403) {
      return { ok: false, kind: "forbidden", message: await readProblemMessage(res) };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export type FinalFailureRequest = {
  poNumber: string;
  propertyId: string;
  /** Required only when a deed of the transaction has no open failure. */
  problemTypeId?: string;
  title?: string;
  reason: string;
  /** true = notify the parties holding tasks; false = stop their tasks silently. */
  notifyParties: boolean;
};

/**
 * «التعذر النهائي عن المعاملة» — the supervisor's final failure on every live deed of the
 * transaction; answers the finalized failures.
 *
 * How it works: `POST /api/failures/final` with the request as JSON.
 * Edge cases: a 400 carries `problemTypeId` when a sibling deed has no open failure, `reason`
 * when blank, `propertyId` when the transaction is final already.
 */
export async function recordFinalFailure(
  config: FailuresApiConfig,
  request: FinalFailureRequest,
): Promise<
  | ApiOk<FailureRecordDto[]>
  | (ApiErr & { errors?: Record<string, string> })
> {
  return postFailureAction<FailureRecordDto[]>(config, "/api/failures/final", request);
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

export async function upgradeFailureToInternal(
  config: FailuresApiConfig,
  id: string,
): Promise<ApiOk<FailureRecordDto> | ApiErr> {
  return postFailureAction(config, `/api/failures/${id}/upgrade`);
}

/** «تصعيد إلى المشرف» — `note` is the specialist's explanation, required by the server. */
export async function submitFailureForReview(
  config: FailuresApiConfig,
  id: string,
  note: string,
): Promise<ApiOk<FailureRecordDto> | ApiErr> {
  return postFailureAction(config, `/api/failures/${id}/submit`, { note });
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
        headers: authHeaders(config.token),
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
    escalationNote: dto.escalationNote ?? "",
    finalNote: dto.finalNote,
    resolutionReason: dto.resolutionReason,
    continueInstructions: dto.continueInstructions,
    status: dto.status,
    specialist: dto.specialist,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    surveyFreezeLiftedAt: dto.surveyFreezeLiftedAt ?? null,
    surveyFreezeLiftReason: dto.surveyFreezeLiftReason ?? null,
    transactionNumber: dto.transactionNumber ?? null,
    transactionDeedCount: dto.transactionDeedCount ?? 1,
    caseSpecialistName: dto.caseSpecialistName ?? null,
  };
}

export type LiftSurveyFreezeRequest = {
  poNumber: string;
  propertyId: string;
  /** At least 10 characters. */
  reason: string;
};

/**
 * The case specialist lifts the survey freeze on one property (the failure stays open) — the engineering
 * office may then start the survey. Answers how many failures were lifted; a refusal carries its Arabic
 * reason in `errors._`.
 */
export async function liftSurveyFreeze(
  config: FailuresApiConfig,
  request: LiftSurveyFreezeRequest,
): Promise<
  | ApiOk<{ lifted: number }>
  | (ApiErr & { errors?: Record<string, string> })
> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/failures/by-property/lift-survey-freeze`, {
      method: "POST",
      headers: authHeaders(config.token),
      body: JSON.stringify(request),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403 || res.status === 400 || res.status === 409) {
      const errors = await parseFieldErrorsFromResponse(res);
      return {
        ok: false,
        kind: res.status === 403 ? "forbidden" : "validation",
        errors,
        message: errors._,
      };
    }
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    const body = (await res.json()) as { lifted?: number };
    return { ok: true, data: { lifted: Number(body.lifted ?? 0) } };
  } catch {
    return { ok: false, kind: "network" };
  }
}
