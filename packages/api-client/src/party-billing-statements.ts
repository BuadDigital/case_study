/**
 * Party billing statements (مسير / أمر صرف) — vendor invoice match + individual pay.
 */
import { getApiBase } from "./api-base";
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

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
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
): Promise<ApiOk<PartyBillingStatementDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/party-billing-statements/${encodeURIComponent(statementId)}/${action}`,
      {
        method: "POST",
        headers: headers(config.token),
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
): Promise<ApiOk<PartyBillingStatementDto> | ApiErr> {
  return postStatementAction(config, statementId, "close", body);
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

export function partyBillingStatementStatusTone(
  status: PartyBillingStatementStatus | string,
): "default" | "warning" | "success" | "info" | "danger" {
  switch (status) {
    case "draft":
      return "default";
    case "issued":
      return "info";
    case "invoice_received":
      return "warning";
    case "closed":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "default";
  }
}
