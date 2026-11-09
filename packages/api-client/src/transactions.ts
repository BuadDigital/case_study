import { readProblemMessage } from "./parse-json";
import { authHeaders, getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import type { ApiErr, ApiOk, PropertyTimelineEventDto, WorkOrdersApiConfig } from "./work-orders";

/**
 * The transaction (المعاملة) above the deeds —. An ordinary property is a
 * transaction with one deed; a linked property has several, each from its own work order.
 */
export type TransactionDto = {
  id: string;
  /**
   * The property's number (ruling 2026-11-08): a single deed's own PR-{YY}-{seq}, a linked property's
   * PR-{YY}-{seq}-L («رقم العقار المرتبط»); null until a deed is numbered.
   */
  referenceNumber?: string | null;
  /** The number people see: `referenceNumber`, or "" while none exists. */
  displayNumber: string;
  /** When the number was locked — the first approved report (or the Enfaz handover); null before. */
  confirmedAtUtc?: string | null;
  /** PRC-… derived from the property number. */
  caseStudyReportNumber?: string | null;
  /** PRV-… derived from the property number. */
  valuationReportNumber?: string | null;
  /** one_building | contract; null for a single deed. */
  linkKind?: string | null;
  linkKindLabelAr?: string | null;
  linkReason?: string | null;
  deedCount: number;
};

/** One deed of the transaction; `isRemoved` marks a deed the specialist took back out. */
export type TransactionDeedDto = {
  propertyId: string;
  poNumber: string;
  /** «رقم المعاملة» — the deed's own PR number; null while it waits for its initial data. */
  referenceNumber?: string | null;
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

/**
 * A deed's label for tables and joined report cells.
 *
 * How it works: a deed identified by a real-estate registry (`identifierType ===
 * "real_estate_reg"`) with a registry number → that number; otherwise the deed number.
 *
 * Edge cases: an empty deed number falls back to the registry number, then "—"; values are
 * trimmed.
 */
export function transactionDeedLabelOf(
  deed: Pick<TransactionDeedDto, "deedNumber" | "realEstateRegNumber" | "identifierType">,
): string {
  const registry = deed.realEstateRegNumber?.trim();
  if (deed.identifierType === "real_estate_reg" && registry) return registry;
  return deed.deedNumber.trim() || registry || "—";
}

/**
 * A deed's date label: the registry date for a registry deed, else the deed date.
 *
 * How it works: same rule as `transactionDeedLabelOf` — a registry-identified deed with a
 * registry date → that date; otherwise the deed date.
 *
 * Edge cases: no deed date → the registry date if any, else "" (callers print "—").
 */
export function transactionDeedDateOf(
  deed: Pick<TransactionDeedDto, "identifierType" | "deedDate" | "realEstateRegDate">,
): string {
  const registry = deed.realEstateRegDate?.trim();
  if (deed.identifierType === "real_estate_reg" && registry) return registry;
  return deed.deedDate?.trim() || registry || "";
}

/**
 * Phase 5: the live deeds of a linked property, in transaction order;
 * empty for an ordinary one-deed property so callers keep printing the single deed.
 *
 * How it works: drops the deeds marked `isRemoved` (taken back out by the specialist) and
 * returns the rest only when two or more remain.
 *
 * Edge cases: no transaction (not loaded, or a 404) → []; a merge left with one live deed after
 * an unmerge → [] as well, so it reads as an ordinary property again.
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
  /** Coordination's formal receipt (ruling 2026-11-02); null while not received. */
  receivedAtUtc?: string | null;
  receivedByName?: string | null;
  /** «يعمل عليها الآن»: the last specialist who opened or saved it (information only). */
  workingByUserId?: string | null;
  workingByName?: string | null;
  workingAtUtc?: string | null;
};

/** A transaction timeline event also says which deed it belongs to. */
export type TransactionTimelineEventDto = PropertyTimelineEventDto & {
  propertyId?: string | null;
  deedLabel?: string | null;
};

/**
 * Maps a transaction read response: 401 → auth, 403 → forbidden, 404 → not_found, any other
 * failure → server; a success parses the JSON body.
 */
async function readJson<T>(res: Response): Promise<ApiOk<T> | ApiErr> {
  if (res.status === 401) return { ok: false, kind: "auth" };
  if (res.status === 403) return { ok: false, kind: "forbidden" };
  if (res.status === 404) return { ok: false, kind: "not_found" };
  if (!res.ok) return { ok: false, kind: "server" };
  return { ok: true, data: (await res.json()) as T };
}

/**
 * The transaction a deed belongs to, with all its deeds and the study holder.
 *
 * How it works: GET `/api/transactions/by-property/{propertyId}` (trimmed, URL-encoded) and
 * maps the answer with `readJson`.
 *
 * Edge cases: a deed with no transaction answers 404 → `not_found` (callers treat it as "no
 * transaction", not an error); a thrown fetch → `network`.
 */
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

/**
 * One transaction by id, with all its deeds and the study holder.
 *
 * How it works: GET `/api/transactions/{id}` mapped with `readJson`; a thrown fetch → `network`.
 */
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

/** How merged deeds belong together: «مبنى واحد» (one building) or «أعيان بعقد» (one contract). */
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

/**
 * Maps a transaction command response so its refusal reaches the user in Arabic.
 *
 * How it works: 401 → auth; 403 → forbidden with the server's message; 404 → not_found; other
 * 5xx → server, 4xx → validation, both with the message from `readProblemMessage`; success parses
 * the JSON body.
 */
async function readCommand<T>(res: Response): Promise<ApiOk<T> | CommandErr> {
  if (res.status === 401) return { ok: false, kind: "auth" };
  if (res.status === 403) return { ok: false, kind: "forbidden", message: await readProblemMessage(res) };
  if (res.status === 404) return { ok: false, kind: "not_found" };
  if (!res.ok) {
    return {
      ok: false,
      kind: res.status >= 500 ? "server" : "validation",
      message: await readProblemMessage(res),
    };
  }
  return { ok: true, data: (await res.json()) as T };
}

/**
 * Deeds matching a deed / registry / PO number (3+ characters), with their merge state.
 *
 * How it works: GET `/api/transactions/{id}/deed-search?q=…` (query trimmed and encoded) for
 * the merge dialog; each hit carries its own transaction number and deed count, and
 * `blockedReasonAr` when it cannot join (the server decides: already in this transaction,
 * bourse inquiry not finished, …).
 *
 * Edge cases: a non-array body → []; refusals carry the server's Arabic message.
 */
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

/**
 * Merge other deeds' transactions into this one (; case-study specialist).
 *
 * How it works: POST `/api/transactions/{id}/merge` with the chosen deeds, the link kind
 * («مبنى واحد» one_building / «أعيان بعقد» contract) and the reason; returns the merged
 * transaction with all its deeds.
 *
 * Edge cases: the server refuses (validation, with an Arabic message) when a deed has not
 * finished intake — since 2026-10-21 that is the only stage condition (`BourseDataCompleted`);
 * inspection and study are not, so a merge may come before distribution.
 */
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

/**
 * «إرسال المعاملة للدراسة»: coordination receives the deed's transaction from the parties (ruling 2026-11-02).
 *
 * How it works: POST `/api/transactions/by-property/{propertyId}/receive`; a 400 carries the reasons
 * (an undelivered party, the wrong stage, already received) as the problem message.
 */
export async function receiveTransaction(
  config: WorkOrdersApiConfig,
  propertyId: string,
): Promise<ApiOk<{ received: boolean; receivedAtUtc?: string | null; receivedByName?: string | null }> | CommandErr> {
  const base = config.baseUrl ?? getApiBase();
  const id = encodeURIComponent(propertyId.trim());
  try {
    const res = await fetch(`${base}/api/transactions/by-property/${id}/receive`, {
      method: "POST",
      headers: authHeaders(config.token, { json: true }),
    });
    return await readCommand(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** One delivery awaited from a party outside the system (Omar 2026-11-08). */
export type TransactionExternalReceiptDto = {
  id: string;
  partyName: string;
  awaited: string;
  status: "pending" | "received" | "cancelled";
  createdAtUtc: string;
  createdByName?: string | null;
  receivedAtUtc?: string | null;
  receivedByName?: string | null;
  note?: string | null;
};

/**
 * The deliveries the deed's transaction awaits from outside the system — GET
 * `/api/transactions/by-property/{propertyId}/external-receipts`. A deed without a transaction → `not_found`.
 */
export async function listTransactionExternalReceipts(
  config: WorkOrdersApiConfig,
  propertyId: string,
): Promise<ApiOk<TransactionExternalReceiptDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  const id = encodeURIComponent(propertyId.trim());
  try {
    const res = await fetch(`${base}/api/transactions/by-property/${id}/external-receipts`, {
      headers: authHeaders(config.token),
    });
    return await readJson<TransactionExternalReceiptDto[]>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** «إضافة استلام من طرف خارجي» — POST; a 400 carries the refusal (role, already sent, blanks). */
export async function addTransactionExternalReceipt(
  config: WorkOrdersApiConfig,
  propertyId: string,
  body: { partyName: string; awaited: string },
): Promise<ApiOk<TransactionExternalReceiptDto> | CommandErr> {
  const base = config.baseUrl ?? getApiBase();
  const id = encodeURIComponent(propertyId.trim());
  try {
    const res = await fetch(`${base}/api/transactions/by-property/${id}/external-receipts`, {
      method: "POST",
      headers: authHeaders(config.token, { json: true }),
      body: JSON.stringify(body),
    });
    return await readCommand<TransactionExternalReceiptDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** The external delivery arrived (`received`) or is no longer awaited (`cancel`), with an optional word. */
export async function closeTransactionExternalReceipt(
  config: WorkOrdersApiConfig,
  receiptId: string,
  outcome: "received" | "cancel",
  note?: string,
): Promise<ApiOk<TransactionExternalReceiptDto> | CommandErr> {
  const base = config.baseUrl ?? getApiBase();
  const id = encodeURIComponent(receiptId.trim());
  try {
    const res = await fetch(`${base}/api/transactions/external-receipts/${id}/${outcome}`, {
      method: "POST",
      headers: authHeaders(config.token, { json: true }),
      body: JSON.stringify({ note: note?.trim() || null }),
    });
    return await readCommand<TransactionExternalReceiptDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** Change how a multi-deed transaction is linked — the stage owner (PATCH `/api/transactions/{id}/link-kind`). */
export async function changeTransactionLinkKind(
  config: WorkOrdersApiConfig,
  transactionId: string,
  body: { linkKind: TransactionLinkKind; reason: string },
): Promise<ApiOk<TransactionDetailDto> | CommandErr> {
  const base = config.baseUrl ?? getApiBase();
  const id = encodeURIComponent(transactionId.trim());
  try {
    const res = await fetch(`${base}/api/transactions/${id}/link-kind`, {
      method: "PATCH",
      headers: authHeaders(config.token, { json: true }),
      body: JSON.stringify(body),
    });
    return await readCommand<TransactionDetailDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

/**
 * «يعمل عليها الآن» heartbeat (POST `/api/transactions/{id}/working`). Fire-and-forget: failures are
 * swallowed — the marker is information only.
 */
export async function markTransactionWorking(
  config: WorkOrdersApiConfig,
  transactionId: string,
): Promise<void> {
  const base = config.baseUrl ?? getApiBase();
  try {
    await fetch(`${base}/api/transactions/${encodeURIComponent(transactionId.trim())}/working`, {
      method: "POST",
      headers: authHeaders(config.token, { json: true }),
    });
  } catch {
    // Information only.
  }
}

/**
 * Take one deed out of a linked property — it becomes a single property under its own number (only
 * before the first report is approved).
 *
 * How it works: POST `/api/transactions/{id}/unmerge-deed` with the deed and the reason; the server
 * moves the deed to its own transaction (and gives it its own valuation request back), recomputes the
 * linked number, and returns the remaining property's detail.
 *
 * Edge cases: once a report is approved (`confirmedAtUtc` set) the server refuses, with its Arabic
 * message.
 */
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

/**
 * One timeline for every deed of the transaction, oldest first.
 *
 * How it works: GET `/api/transactions/{id}/timeline` mapped with `readJson`; each event names
 * the deed it belongs to (`propertyId`, `deedLabel`).
 *
 * Edge cases: a non-array body → []; a thrown fetch → `network`.
 */
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

/** «إلغاء المعاملة» reasons — our own mistakes only (a transaction Enfaz stops is a failure). */
export type TransactionCancellationReason = "duplicate" | "wrong_entry" | "other";

/** One deed a cancellation covers, or would cover; `blockedReason` says why it is left out. */
export type TransactionCancellationDeedDto = {
  propertyId: string;
  poNumber: string;
  deedNumber: string;
  transactionId: string;
  transactionNumber: string;
  blockedReason?: string | null;
};

/** What a request would cancel — the dialog shows it before anything is sent. */
export type TransactionCancellationPreviewDto = {
  scope: "transaction" | "work-order";
  scopeRef: string;
  poNumber: string;
  deeds: TransactionCancellationDeedDto[];
  excluded: TransactionCancellationDeedDto[];
};

export type TransactionCancellationDto = {
  id: string;
  scope: "transaction" | "work-order";
  scopeRef: string;
  poNumber: string;
  status: "pending" | "approved" | "rejected" | "reactivated";
  reasonCode: TransactionCancellationReason;
  reasonLabel: string;
  note: string;
  attachmentId?: string | null;
  deeds: TransactionCancellationDeedDto[];
  requestedByName: string;
  requestedAtUtc: string;
  decidedByName?: string | null;
  decidedAtUtc?: string | null;
  decisionNote?: string | null;
  reactivatedByName?: string | null;
  reactivatedAtUtc?: string | null;
  reactivationNote?: string | null;
};

/** A deed's cancellation state: the pending request and the approved cancellation, when there are. */
export type TransactionCancellationStateDto = {
  pending?: TransactionCancellationDto | null;
  cancelled?: TransactionCancellationDto | null;
};

/**
 * What cancelling this deed's transaction (`propertyId`) or this work order (`poNumber`) would cancel.
 *
 * How it works: GET `/api/transaction-cancellations/preview` with the one id given; the server
 * returns the deeds it would cancel and those it leaves out, each with its reason.
 *
 * Edge cases: an unknown deed / work order comes back as `validation` with the Arabic message.
 */
export async function previewTransactionCancellation(
  config: WorkOrdersApiConfig,
  scope: { propertyId: string } | { poNumber: string },
): Promise<ApiOk<TransactionCancellationPreviewDto> | CommandErr> {
  const base = config.baseUrl ?? getApiBase();
  const qs = "propertyId" in scope
    ? `propertyId=${encodeURIComponent(scope.propertyId.trim())}`
    : `poNumber=${encodeURIComponent(scope.poNumber.trim())}`;
  try {
    const res = await fetch(`${base}/api/transaction-cancellations/preview?${qs}`, {
      headers: authHeaders(config.token),
    });
    return await readCommand<TransactionCancellationPreviewDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

/**
 * The pending request and the approved cancellation covering one deed.
 *
 * How it works: GET `/api/transaction-cancellations/by-property/{propertyId}`.
 * Edge cases: a deed with neither answers `{}`, never 404.
 */
export async function getTransactionCancellationState(
  config: WorkOrdersApiConfig,
  propertyId: string,
): Promise<ApiOk<TransactionCancellationStateDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  const id = encodeURIComponent(propertyId.trim());
  try {
    const res = await fetch(`${base}/api/transaction-cancellations/by-property/${id}`, {
      headers: authHeaders(config.token),
    });
    return await readJson<TransactionCancellationStateDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** Requests, newest first; `status` narrows them (e.g. "pending" for the supervisor). */
export async function listTransactionCancellations(
  config: WorkOrdersApiConfig,
  status?: TransactionCancellationDto["status"],
): Promise<ApiOk<TransactionCancellationDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  try {
    const res = await fetch(`${base}/api/transaction-cancellations${qs}`, {
      headers: authHeaders(config.token),
    });
    const result = await readJson<TransactionCancellationDto[]>(res);
    if (!result.ok) return result;
    return { ok: true, data: Array.isArray(result.data) ? result.data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/**
 * Raises a cancellation request — the case specialist's waits for the supervisor; the supervisor's
 * own request comes back already approved.
 *
 * How it works: POST `/api/transaction-cancellations` with one scope (a deed of the transaction, or
 * the work order), the reason, the note and an optional uploaded file id.
 *
 * Edge cases: refusals (role, a deed on Enfaz, a pending request already there) carry the server's
 * Arabic message; a role refusal is `forbidden`.
 */
export async function requestTransactionCancellation(
  config: WorkOrdersApiConfig,
  body: {
    propertyId?: string;
    poNumber?: string;
    reasonCode: TransactionCancellationReason;
    note: string;
    attachmentId?: string | null;
  },
): Promise<ApiOk<TransactionCancellationDto> | CommandErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/transaction-cancellations`, {
      method: "POST",
      headers: authHeaders(config.token, { json: true }),
      body: JSON.stringify(body),
    });
    return await readCommand<TransactionCancellationDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

/**
 * The supervisor's decision on a request, or the reactivation of a cancelled transaction.
 *
 * How it works: POST `/api/transaction-cancellations/{id}/{approve|reject|reactivate}` with the
 * note (required for reactivate, optional otherwise).
 *
 * Edge cases: a request already decided is refused with an Arabic message.
 */
export async function decideTransactionCancellation(
  config: WorkOrdersApiConfig,
  id: string,
  action: "approve" | "reject" | "reactivate",
  note: string,
): Promise<ApiOk<TransactionCancellationDto> | CommandErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/transaction-cancellations/${encodeURIComponent(id.trim())}/${action}`,
      {
        method: "POST",
        headers: authHeaders(config.token, { json: true }),
        body: JSON.stringify({ note }),
      },
    );
    return await readCommand<TransactionCancellationDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}
