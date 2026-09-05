/**
 * Party billing statements (payroll sheet / payment order) — vendor invoice match + individual pay.
 */
import { getApiBase } from "./api-base";
import { withIdempotencyKey } from "./idempotency-key";
import {
  fetchListPage,
  type ListPageQuery,
  type PagedResultDto,
} from "./pagination";
import { repositoryFetch as fetch } from "./write-repository";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

export type PartyBillingStatementsApiConfig = WorkOrdersApiConfig;

export type PartyBillingStatementStatus =
  | "draft"
  | "issued"
  | "invoice_received"
  | "closed"
  | "cancelled";

export type PartyBillingPayeeType = "vendor" | "individual";

export type PartyBillingReadyLineDto = {
  workflowTaskId: string;
  propertyId: string | null;
  propertyLabel: string;
  poNumber: string;
  assigneeId: string | null;
  taskKind: string;
  payeeType: PartyBillingPayeeType;
  payeeTypeLabel: string;
  agreedFeeSar: number;
  supervisorDiscountSar: number;
  netFeeSar: number;
  billingStatus: string;
  billingStatusLabel: string;
  accruedAtUtc: string | null;
  updatedAtUtc: string | null;
};

export type PartyBillingStatementLineDto = {
  id: string;
  workflowTaskId: string;
  propertyId: string | null;
  propertyLabel: string;
  poNumber: string;
  netFeeSar: number;
  billingStatus: string;
  billingStatusLabel: string;
};

export type PartyBillingRejectedInvoiceDto = {
  invoiceNumber: string;
  invoiceDate: string | null;
  attachmentId: string | null;
  reason: string;
  rejectedByUserId: string;
  rejectedAtUtc: string;
};

export type PartyBillingStatementDto = {
  id: string;
  referenceNumber: string;
  assigneeId: string;
  payeeType: PartyBillingPayeeType;
  payeeTypeLabel: string;
  taskKind: string | null;
  status: PartyBillingStatementStatus;
  statusLabel: string;
  totalNetSar: number;
  createdByUserId: string;
  createdAtUtc: string;
  issuedAtUtc: string | null;
  closedAtUtc: string | null;
  externalInvoiceNumber: string | null;
  transferReceiptAttachmentId: string | null;
  transferReceiptRef: string | null;
  transferReference: string | null;
  disbursementVoucher: string | null;
  paidAtUtc: string | null;
  notes: string | null;
  vendorInvoiceNumber: string | null;
  vendorInvoiceDate: string | null;
  vendorInvoiceAttachmentId: string | null;
  vendorInvoiceSubmittedAtUtc: string | null;
  vendorInvoiceMatched: boolean;
  vendorInvoiceMatchedAtUtc: string | null;
  rejectedInvoices: PartyBillingRejectedInvoiceDto[];
  cancelledAtUtc: string | null;
  cancelReason: string | null;
  lines: PartyBillingStatementLineDto[];
};

export type CreatePartyBillingStatementRequest = {
  workflowTaskIds: string[];
  deferUnselectedForAssignee?: boolean;
  notes?: string;
};

export type CreatePartyBillingStatementResponseDto = {
  statement: PartyBillingStatementDto | null;
  deferredLines: PartyBillingReadyLineDto[];
  error?: string | null;
};

/** @deprecated Use CreatePartyBillingStatementResponseDto */
export type CreatePartyBillingStatementResult = CreatePartyBillingStatementResponseDto;

export type CreateMonthPartyBillingStatementsResponseDto = {
  created: PartyBillingStatementDto[];
  assigneesCovered: number;
  linesIncluded: number;
  error?: string | null;
};

/** @deprecated Use CreateMonthPartyBillingStatementsResponseDto */
export type CreateMonthPartyBillingStatementsResult =
  CreateMonthPartyBillingStatementsResponseDto;

export type ClosePartyBillingStatementRequest = {
  disbursementVoucher: string;
  transferReference: string;
  transferReceiptAttachmentId: string;
  transferReceiptRef?: string;
  externalInvoiceNumber?: string;
  paidAtUtc?: string;
  notes?: string;
};

export type SubmitVendorInvoiceRequest = {
  invoiceNumber: string;
  invoiceDate?: string | null;
  attachmentId: string;
};

export type RejectVendorInvoiceRequest = {
  reason: string;
};

export type CancelPartyBillingStatementRequest = {
  reason: string;
};

export type DeferPartyBillingLinesRequest = {
  workflowTaskIds: string[];
};

export type DeferPartyBillingLinesResponseDto = {
  deferred: PartyBillingReadyLineDto[];
  failed: { workflowTaskId: string; error: string }[];
};

/** @deprecated Use DeferPartyBillingLinesResponseDto */
export type DeferPartyBillingLinesResult = DeferPartyBillingLinesResponseDto;

function headers(token: string, idempotencyKey?: string): HeadersInit {
  const base = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  return idempotencyKey ? withIdempotencyKey(base, idempotencyKey) : base;
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function normalizeReadyLine(raw: Record<string, unknown>): PartyBillingReadyLineDto {
  const payeeType = String(
    raw.payeeType ?? raw.PayeeType ?? "vendor",
  ) as PartyBillingPayeeType;
  return {
    workflowTaskId: String(raw.workflowTaskId ?? raw.WorkflowTaskId ?? ""),
    propertyId: (raw.propertyId ?? raw.PropertyId ?? null) as string | null,
    propertyLabel: String(raw.propertyLabel ?? raw.PropertyLabel ?? ""),
    poNumber: String(raw.poNumber ?? raw.PoNumber ?? ""),
    assigneeId: (raw.assigneeId ?? raw.AssigneeId ?? null) as string | null,
    taskKind: String(raw.taskKind ?? raw.TaskKind ?? ""),
    payeeType,
    payeeTypeLabel: String(
      raw.payeeTypeLabel ?? raw.PayeeTypeLabel ?? (payeeType === "individual" ? "فرد" : "مورّد"),
    ),
    agreedFeeSar: Number(raw.agreedFeeSar ?? raw.AgreedFeeSar ?? 0),
    supervisorDiscountSar: Number(
      raw.supervisorDiscountSar ?? raw.SupervisorDiscountSar ?? 0,
    ),
    netFeeSar: Number(raw.netFeeSar ?? raw.NetFeeSar ?? 0),
    billingStatus: String(raw.billingStatus ?? raw.BillingStatus ?? ""),
    billingStatusLabel: String(
      raw.billingStatusLabel ?? raw.BillingStatusLabel ?? "",
    ),
    accruedAtUtc: (raw.accruedAtUtc ?? raw.AccruedAtUtc ?? null) as string | null,
    updatedAtUtc: (raw.updatedAtUtc ?? raw.UpdatedAtUtc ?? null) as string | null,
  };
}

function normalizeStatementLine(
  raw: Record<string, unknown>,
): PartyBillingStatementLineDto {
  return {
    id: String(raw.id ?? raw.Id ?? ""),
    workflowTaskId: String(raw.workflowTaskId ?? raw.WorkflowTaskId ?? ""),
    propertyId: (raw.propertyId ?? raw.PropertyId ?? null) as string | null,
    propertyLabel: String(raw.propertyLabel ?? raw.PropertyLabel ?? ""),
    poNumber: String(raw.poNumber ?? raw.PoNumber ?? ""),
    netFeeSar: Number(raw.netFeeSar ?? raw.NetFeeSar ?? 0),
    billingStatus: String(raw.billingStatus ?? raw.BillingStatus ?? ""),
    billingStatusLabel: String(
      raw.billingStatusLabel ?? raw.BillingStatusLabel ?? "",
    ),
  };
}

function normalizeRejected(
  raw: Record<string, unknown>,
): PartyBillingRejectedInvoiceDto {
  return {
    invoiceNumber: String(raw.invoiceNumber ?? raw.InvoiceNumber ?? ""),
    invoiceDate: (raw.invoiceDate ?? raw.InvoiceDate ?? null) as string | null,
    attachmentId: (raw.attachmentId ?? raw.AttachmentId ?? null) as string | null,
    reason: String(raw.reason ?? raw.Reason ?? ""),
    rejectedByUserId: String(
      raw.rejectedByUserId ?? raw.RejectedByUserId ?? "",
    ),
    rejectedAtUtc: String(raw.rejectedAtUtc ?? raw.RejectedAtUtc ?? ""),
  };
}

function normalizeStatement(raw: Record<string, unknown>): PartyBillingStatementDto {
  const linesRaw = (raw.lines ?? raw.Lines ?? []) as unknown[];
  const rejectedRaw = (raw.rejectedInvoices ?? raw.RejectedInvoices ?? []) as unknown[];
  const payeeType = String(
    raw.payeeType ?? raw.PayeeType ?? "vendor",
  ) as PartyBillingPayeeType;
  return {
    id: String(raw.id ?? raw.Id ?? ""),
    referenceNumber: String(raw.referenceNumber ?? raw.ReferenceNumber ?? ""),
    assigneeId: String(raw.assigneeId ?? raw.AssigneeId ?? ""),
    payeeType,
    payeeTypeLabel: String(
      raw.payeeTypeLabel ??
        raw.PayeeTypeLabel ??
        (payeeType === "individual" ? "فرد" : "مورّد"),
    ),
    taskKind: (raw.taskKind ?? raw.TaskKind ?? null) as string | null,
    status: String(raw.status ?? raw.Status ?? "draft") as PartyBillingStatementStatus,
    statusLabel: String(raw.statusLabel ?? raw.StatusLabel ?? ""),
    totalNetSar: Number(raw.totalNetSar ?? raw.TotalNetSar ?? 0),
    createdByUserId: String(raw.createdByUserId ?? raw.CreatedByUserId ?? ""),
    createdAtUtc: String(raw.createdAtUtc ?? raw.CreatedAtUtc ?? ""),
    issuedAtUtc: (raw.issuedAtUtc ?? raw.IssuedAtUtc ?? null) as string | null,
    closedAtUtc: (raw.closedAtUtc ?? raw.ClosedAtUtc ?? null) as string | null,
    externalInvoiceNumber: (raw.externalInvoiceNumber ??
      raw.ExternalInvoiceNumber ??
      null) as string | null,
    transferReceiptAttachmentId: (raw.transferReceiptAttachmentId ??
      raw.TransferReceiptAttachmentId ??
      null) as string | null,
    transferReceiptRef: (raw.transferReceiptRef ??
      raw.TransferReceiptRef ??
      null) as string | null,
    transferReference: (raw.transferReference ??
      raw.TransferReference ??
      null) as string | null,
    disbursementVoucher: (raw.disbursementVoucher ??
      raw.DisbursementVoucher ??
      null) as string | null,
    paidAtUtc: (raw.paidAtUtc ?? raw.PaidAtUtc ?? null) as string | null,
    notes: (raw.notes ?? raw.Notes ?? null) as string | null,
    vendorInvoiceNumber: (raw.vendorInvoiceNumber ??
      raw.VendorInvoiceNumber ??
      null) as string | null,
    vendorInvoiceDate: (raw.vendorInvoiceDate ??
      raw.VendorInvoiceDate ??
      null) as string | null,
    vendorInvoiceAttachmentId: (raw.vendorInvoiceAttachmentId ??
      raw.VendorInvoiceAttachmentId ??
      null) as string | null,
    vendorInvoiceSubmittedAtUtc: (raw.vendorInvoiceSubmittedAtUtc ??
      raw.VendorInvoiceSubmittedAtUtc ??
      null) as string | null,
    vendorInvoiceMatched: Boolean(
      raw.vendorInvoiceMatched ?? raw.VendorInvoiceMatched ?? false,
    ),
    vendorInvoiceMatchedAtUtc: (raw.vendorInvoiceMatchedAtUtc ??
      raw.VendorInvoiceMatchedAtUtc ??
      null) as string | null,
    rejectedInvoices: rejectedRaw.map((r) => normalizeRejected(asRecord(r))),
    cancelledAtUtc: (raw.cancelledAtUtc ?? raw.CancelledAtUtc ?? null) as
      | string
      | null,
    cancelReason: (raw.cancelReason ?? raw.CancelReason ?? null) as string | null,
    lines: linesRaw.map((l) => normalizeStatementLine(asRecord(l))),
  };
}

function queryString(params: {
  assigneeId?: string;
  status?: string;
  issuedOrLaterOnly?: boolean;
}): string {
  const sp = new URLSearchParams();
  if (params.assigneeId) sp.set("assigneeId", params.assigneeId);
  if (params.status) sp.set("status", params.status);
  if (params.issuedOrLaterOnly) sp.set("issuedOrLaterOnly", "true");
  const q = sp.toString();
  return q ? `?${q}` : "";
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as Record<string, unknown>;
    return String(body.error ?? body.Error ?? `HTTP ${res.status}`);
  } catch {
    return `HTTP ${res.status}`;
  }
}

function httpErr(res: Response, message?: string): ApiErr {
  if (res.status === 401) return { ok: false, kind: "auth", message };
  if (res.status === 404) return { ok: false, kind: "not_found", message };
  return { ok: false, kind: "server", message };
}

export async function listPartyBillingReadyLines(
  config: PartyBillingStatementsApiConfig,
  assigneeId?: string,
): Promise<ApiOk<PartyBillingReadyLineDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const qs = assigneeId
      ? `?assigneeId=${encodeURIComponent(assigneeId)}`
      : "";
    const res = await fetch(`${base}/api/party-billing-statements/ready-lines${qs}`, {
      headers: headers(config.token),
    });
    if (!res.ok) return httpErr(res);
    const raw = (await res.json()) as unknown[];
    return {
      ok: true,
      data: raw.map((r) => normalizeReadyLine(asRecord(r))),
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function listPartyBillingStatements(
  config: PartyBillingStatementsApiConfig,
  query: {
    assigneeId?: string;
    status?: string;
    issuedOrLaterOnly?: boolean;
  } = {},
): Promise<ApiOk<PartyBillingStatementDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/party-billing-statements${queryString(query)}`,
      { headers: headers(config.token) },
    );
    if (!res.ok) return httpErr(res);
    const raw = (await res.json()) as unknown[];
    return {
      ok: true,
      data: raw.map((r) => normalizeStatement(asRecord(r))),
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export type PartyBillingStatementListSort =
  | "created"
  | "issued"
  | "closed"
  | "reference"
  | "total";

/**
 * `GET /api/party-billing-statements` — pagination-contract §9.1. `status`
 * takes one status or a list (sent as CSV); the actor narrowing (an office
 * sees only its own issued-or-later statements) happens on the server.
 */
export type PartyBillingStatementListQuery = Omit<ListPageQuery, "sort"> & {
  sort?: PartyBillingStatementListSort;
  assigneeId?: string;
  status?: PartyBillingStatementStatus | readonly PartyBillingStatementStatus[];
  issuedOrLaterOnly?: boolean;
};

function statementListParams(query?: PartyBillingStatementListQuery) {
  return {
    page: query?.page,
    pageSize: query?.pageSize,
    sort: query?.sort,
    dir: query?.dir,
    q: query?.q,
    assigneeId: query?.assigneeId,
    status: query?.status,
    // Only restate the gate when it is on; `false` is the endpoint default.
    issuedOrLaterOnly: query?.issuedOrLaterOnly ? true : undefined,
  };
}

/** One server page of statements — filters, sort and paging all server-side. */
export async function listPartyBillingStatementsPage(
  config: PartyBillingStatementsApiConfig,
  query?: PartyBillingStatementListQuery,
): Promise<ApiOk<PagedResultDto<PartyBillingStatementDto>> | ApiErr> {
  const result = await fetchListPage<unknown>(
    { ...config, baseUrl: config.baseUrl ?? getApiBase() },
    "/api/party-billing-statements",
    statementListParams(query),
  );
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      ...result.data,
      items: result.data.items.map((r) => normalizeStatement(asRecord(r))),
    },
  };
}

export type PartyBillingReadyLineListSort = "updated" | "accrued" | "net" | "po";

/**
 * `GET /api/party-billing-statements/ready-lines` — pagination-contract §9.2.
 * `sort=accrued&dir=asc` is the dues screen's oldest-first order; `q` covers
 * the property label, PO number and workflow task id.
 */
export type PartyBillingReadyLineListQuery = Omit<ListPageQuery, "sort"> & {
  sort?: PartyBillingReadyLineListSort;
  assigneeId?: string;
};

/** One server page of ready dues — cut over the synthesised list, count exact. */
export async function listPartyBillingReadyLinesPage(
  config: PartyBillingStatementsApiConfig,
  query?: PartyBillingReadyLineListQuery,
): Promise<ApiOk<PagedResultDto<PartyBillingReadyLineDto>> | ApiErr> {
  const result = await fetchListPage<unknown>(
    { ...config, baseUrl: config.baseUrl ?? getApiBase() },
    "/api/party-billing-statements/ready-lines",
    {
      page: query?.page,
      pageSize: query?.pageSize,
      sort: query?.sort,
      dir: query?.dir,
      q: query?.q,
      assigneeId: query?.assigneeId,
    },
  );
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      ...result.data,
      items: result.data.items.map((r) => normalizeReadyLine(asRecord(r))),
    },
  };
}

/**
 * One statement by id, under the list's visibility rule (404 for a payee's
 * unissued or foreign statement). Lets a deep-linked statement open when it
 * is not on the page the list is showing.
 */
export async function getPartyBillingStatement(
  config: PartyBillingStatementsApiConfig,
  statementId: string,
): Promise<ApiOk<PartyBillingStatementDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/party-billing-statements/${encodeURIComponent(statementId)}`,
      { headers: headers(config.token) },
    );
    if (!res.ok) return httpErr(res);
    return { ok: true, data: normalizeStatement(asRecord(await res.json())) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function createPartyBillingStatement(
  config: PartyBillingStatementsApiConfig,
  body: CreatePartyBillingStatementRequest,
): Promise<ApiOk<CreatePartyBillingStatementResponseDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/party-billing-statements`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    const raw = asRecord(await res.json().catch(() => ({})));
    if (!res.ok) {
      return httpErr(
        res,
        String(raw.error ?? raw.Error ?? `HTTP ${res.status}`),
      );
    }
    return {
      ok: true,
      data: {
        statement: raw.statement || raw.Statement
          ? normalizeStatement(asRecord(raw.statement ?? raw.Statement))
          : null,
        deferredLines: (
          (raw.deferredLines ?? raw.DeferredLines ?? []) as unknown[]
        ).map((r) => normalizeReadyLine(asRecord(r))),
        error: (raw.error ?? raw.Error ?? null) as string | null,
      },
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function createMonthVendorStatements(
  config: PartyBillingStatementsApiConfig,
): Promise<ApiOk<CreateMonthPartyBillingStatementsResponseDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/party-billing-statements/auto-month-vendor`,
      { method: "POST", headers: headers(config.token) },
    );
    const raw = asRecord(await res.json().catch(() => ({})));
    if (!res.ok) {
      return httpErr(
        res,
        String(raw.error ?? raw.Error ?? `HTTP ${res.status}`),
      );
    }
    return {
      ok: true,
      data: {
        created: ((raw.created ?? raw.Created ?? []) as unknown[]).map((r) =>
          normalizeStatement(asRecord(r)),
        ),
        assigneesCovered: Number(
          raw.assigneesCovered ?? raw.AssigneesCovered ?? 0,
        ),
        linesIncluded: Number(raw.linesIncluded ?? raw.LinesIncluded ?? 0),
        error: (raw.error ?? raw.Error ?? null) as string | null,
      },
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}

async function postStatementAction(
  config: PartyBillingStatementsApiConfig,
  statementId: string,
  action: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<ApiOk<PartyBillingStatementDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/party-billing-statements/${encodeURIComponent(statementId)}/${action}`,
      {
        method: "POST",
        headers: headers(config.token, idempotencyKey),
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
    if (!res.ok) return httpErr(res, await readError(res));
    return { ok: true, data: normalizeStatement(asRecord(await res.json())) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function issuePartyBillingStatement(
  config: PartyBillingStatementsApiConfig,
  statementId: string,
): Promise<ApiOk<PartyBillingStatementDto> | ApiErr> {
  return postStatementAction(config, statementId, "issue");
}

export async function submitVendorInvoice(
  config: PartyBillingStatementsApiConfig,
  statementId: string,
  body: SubmitVendorInvoiceRequest,
): Promise<ApiOk<PartyBillingStatementDto> | ApiErr> {
  return postStatementAction(config, statementId, "submit-invoice", body);
}

export async function matchVendorInvoice(
  config: PartyBillingStatementsApiConfig,
  statementId: string,
): Promise<ApiOk<PartyBillingStatementDto> | ApiErr> {
  return postStatementAction(config, statementId, "match-invoice");
}

export async function rejectVendorInvoice(
  config: PartyBillingStatementsApiConfig,
  statementId: string,
  body: RejectVendorInvoiceRequest,
): Promise<ApiOk<PartyBillingStatementDto> | ApiErr> {
  return postStatementAction(config, statementId, "reject-invoice", body);
}

export async function cancelPartyBillingStatement(
  config: PartyBillingStatementsApiConfig,
  statementId: string,
  body: CancelPartyBillingStatementRequest,
): Promise<ApiOk<PartyBillingStatementDto> | ApiErr> {
  return postStatementAction(config, statementId, "cancel", body);
}

export async function closePartyBillingStatement(
  config: PartyBillingStatementsApiConfig,
  statementId: string,
  body: ClosePartyBillingStatementRequest,
  idempotencyKey?: string,
): Promise<ApiOk<PartyBillingStatementDto> | ApiErr> {
  return postStatementAction(config, statementId, "close", body, idempotencyKey);
}

export async function deferPartyBillingLines(
  config: PartyBillingStatementsApiConfig,
  body: DeferPartyBillingLinesRequest,
): Promise<ApiOk<DeferPartyBillingLinesResponseDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/party-billing-statements/defer-lines`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (!res.ok) return httpErr(res);
    const raw = asRecord(await res.json());
    return {
      ok: true,
      data: {
        deferred: ((raw.deferred ?? raw.Deferred ?? []) as unknown[]).map((r) =>
          normalizeReadyLine(asRecord(r)),
        ),
        failed: ((raw.failed ?? raw.Failed ?? []) as unknown[]).map((f) => {
          const row = asRecord(f);
          return {
            workflowTaskId: String(
              row.workflowTaskId ?? row.WorkflowTaskId ?? "",
            ),
            error: String(row.error ?? row.Error ?? ""),
          };
        }),
      },
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}
