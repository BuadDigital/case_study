import { authHeaders, getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import type { ApiErr, ApiOk, PropertyTimelineEventDto, WorkOrdersApiConfig } from "./work-orders";

/**
 * The transaction (المعاملة) above the deeds — decision 2026-10-19. An ordinary property is a
 * transaction with one deed; a linked property has several, each from its own work order.
 */
export type TransactionDto = {
  id: string;
  /** TMP-{YY}-{seq}; shown until the official reference exists. */
  draftNumber: string;
  /** PR-{year}-{seq}; null until the first report approval. */
  referenceNumber?: string | null;
  /** The number people see: the official reference once confirmed, else the draft number. */
  displayNumber: string;
  confirmedAtUtc?: string | null;
  /** PRC-… when confirmed. */
  caseStudyReportNumber?: string | null;
  /** PRV-… when confirmed. */
  valuationReportNumber?: string | null;
  /** one_building | contract; null for a single deed. */
  linkKind?: string | null;
  linkKindLabelAr?: string | null;
  linkReason?: string | null;
  deedCount: number;
};

export type TransactionDeedDto = {
  propertyId: string;
  poNumber: string;
  identifierType?: string;
  deedNumber: string;
  deedDate?: string | null;
  realEstateRegNumber?: string | null;
  realEstateRegDate?: string | null;
  deedKindLabelAr?: string | null;
  city: string;
  district: string;
  area?: string | null;
  isRemoved: boolean;
  createdAtUtc: string;
};

/** A deed's label: the registry number when identified by one, else the deed number. */
export function transactionDeedLabelOf(
  deed: Pick<TransactionDeedDto, "deedNumber" | "realEstateRegNumber" | "identifierType">,
): string {
  const registry = deed.realEstateRegNumber?.trim();
  if (deed.identifierType === "real_estate_reg" && registry) return registry;
  return deed.deedNumber.trim() || registry || "—";
}

/** A deed's date label: the registry date for a registry deed, else the deed date. */
export function transactionDeedDateOf(
  deed: Pick<TransactionDeedDto, "identifierType" | "deedDate" | "realEstateRegDate">,
): string {
  const registry = deed.realEstateRegDate?.trim();
  if (deed.identifierType === "real_estate_reg" && registry) return registry;
  return deed.deedDate?.trim() || registry || "";
}

/**
 * Phase 5 (decision 2026-10-19): the live deeds of a linked property, in transaction order;
 * empty for an ordinary one-deed property so callers keep printing the single deed.
 */
export function linkedPropertyDeeds(
  transaction: Pick<TransactionDetailDto, "deeds"> | null | undefined,
): TransactionDeedDto[] {
  const live = (transaction?.deeds ?? []).filter((d) => !d.isRemoved);
  return live.length > 1 ? live : [];
}

export type TransactionDetailDto = TransactionDto & {
  deeds: TransactionDeedDto[];
  /** Phase 4: the deed whose case-study parent task carries the transaction's one study. */
  studyHolderPropertyId?: string | null;
  /** Phase 4: that parent task — the study workspace route — when it exists. */
  studyHolderTaskId?: string | null;
};

/** A transaction timeline event also says which deed it belongs to. */
export type TransactionTimelineEventDto = PropertyTimelineEventDto & {
  propertyId?: string | null;
  deedLabel?: string | null;
};

async function readJson<T>(res: Response): Promise<ApiOk<T> | ApiErr> {
  if (res.status === 401) return { ok: false, kind: "auth" };
  if (res.status === 403) return { ok: false, kind: "forbidden" };
  if (res.status === 404) return { ok: false, kind: "not_found" };
  if (!res.ok) return { ok: false, kind: "server" };
  return { ok: true, data: (await res.json()) as T };
}

export async function getTransactionByProperty(
  config: WorkOrdersApiConfig,
  propertyId: string,
): Promise<ApiOk<TransactionDetailDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  const id = encodeURIComponent(propertyId.trim());
  try {
    const res = await fetch(`${base}/api/transactions/by-property/${id}`, {
      headers: authHeaders(config.token),
    });
    return await readJson<TransactionDetailDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function getTransaction(
  config: WorkOrdersApiConfig,
  transactionId: string,
): Promise<ApiOk<TransactionDetailDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  const id = encodeURIComponent(transactionId.trim());
  try {
    const res = await fetch(`${base}/api/transactions/${id}`, {
      headers: authHeaders(config.token),
    });
    return await readJson<TransactionDetailDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

export type TransactionLinkKind = "one_building" | "contract";

/** A deed found for the merge dialog; `blockedReasonAr` says why it cannot join when it cannot. */
export type TransactionDeedSearchHitDto = {
  propertyId: string;
  poNumber: string;
  identifierType?: string;
  deedNumber: string;
  realEstateRegNumber?: string | null;
  city: string;
  district: string;
  ownerName?: string | null;
  transactionId: string;
  transactionNumber: string;
  transactionDeedCount: number;
  blockedReasonAr?: string | null;
};

type CommandErr = ApiErr & { message?: string };

async function readCommand<T>(res: Response): Promise<ApiOk<T> | CommandErr> {
  if (res.status === 401) return { ok: false, kind: "auth" };
  if (res.status === 403) return { ok: false, kind: "forbidden", message: await problemDetail(res) };
  if (res.status === 404) return { ok: false, kind: "not_found" };
  if (!res.ok) {
    return {
      ok: false,
      kind: res.status >= 500 ? "server" : "validation",
      message: await problemDetail(res),
    };
  }
  return { ok: true, data: (await res.json()) as T };
}

async function problemDetail(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.clone().json()) as { detail?: string; title?: string; errors?: Record<string, string> };
    const first = body?.errors ? Object.values(body.errors).find((v) => typeof v === "string" && v) : undefined;
    return body?.detail || first || body?.title || undefined;
  } catch {
    return undefined;
  }
}

/** Deeds matching a deed / registry / PO number (3+ characters), with their merge state. */
export async function searchTransactionDeeds(
  config: WorkOrdersApiConfig,
  transactionId: string,
  query: string,
): Promise<ApiOk<TransactionDeedSearchHitDto[]> | CommandErr> {
  const base = config.baseUrl ?? getApiBase();
  const id = encodeURIComponent(transactionId.trim());
  try {
    const res = await fetch(`${base}/api/transactions/${id}/deed-search?q=${encodeURIComponent(query.trim())}`, {
      headers: authHeaders(config.token),
    });
    const result = await readCommand<TransactionDeedSearchHitDto[]>(res);
    if (!result.ok) return result;
    return { ok: true, data: Array.isArray(result.data) ? result.data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** Merge other deeds' transactions into this one (decision 2026-10-19; case-study specialist). */
export async function mergeTransactions(
  config: WorkOrdersApiConfig,
  transactionId: string,
  body: { propertyIds: string[]; linkKind: TransactionLinkKind; reason: string },
): Promise<ApiOk<TransactionDetailDto> | CommandErr> {
  const base = config.baseUrl ?? getApiBase();
  const id = encodeURIComponent(transactionId.trim());
  try {
    const res = await fetch(`${base}/api/transactions/${id}/merge`, {
      method: "POST",
      headers: authHeaders(config.token, { json: true }),
      body: JSON.stringify(body),
    });
    return await readCommand<TransactionDetailDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** Take one deed out of the transaction into a new draft transaction (only before the official number). */
export async function unmergeTransactionDeed(
  config: WorkOrdersApiConfig,
  transactionId: string,
  body: { propertyId: string; reason: string },
): Promise<ApiOk<TransactionDetailDto> | CommandErr> {
  const base = config.baseUrl ?? getApiBase();
  const id = encodeURIComponent(transactionId.trim());
  try {
    const res = await fetch(`${base}/api/transactions/${id}/unmerge-deed`, {
      method: "POST",
      headers: authHeaders(config.token, { json: true }),
      body: JSON.stringify(body),
    });
    return await readCommand<TransactionDetailDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** One timeline for every deed of the transaction, oldest first. */
export async function getTransactionTimeline(
  config: WorkOrdersApiConfig,
  transactionId: string,
): Promise<ApiOk<TransactionTimelineEventDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  const id = encodeURIComponent(transactionId.trim());
  try {
    const res = await fetch(`${base}/api/transactions/${id}/timeline`, {
      headers: authHeaders(config.token),
    });
    const result = await readJson<TransactionTimelineEventDto[]>(res);
    if (!result.ok) return result;
    return { ok: true, data: Array.isArray(result.data) ? result.data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}
