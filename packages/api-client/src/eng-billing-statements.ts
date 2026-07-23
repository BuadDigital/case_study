/**
 * Engineering-office monthly billing statements (كشف فوترة) — stages 6–8.
 */
import { getApiBase } from "./index";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

export type EngBillingStatementsApiConfig = WorkOrdersApiConfig;

export type EngBillingStatementStatus = "draft" | "issued" | "closed";

export type EngBillingReadyLineDto = {
  workflowTaskId: string;
  propertyId: string | null;
  propertyLabel: string;
  poNumber: string;
  assigneeId: string | null;
  agreedFeeSar: number;
  supervisorDiscountSar: number;
  netFeeSar: number;
  billingStatus: string;
  billingStatusLabel: string;
  accruedAtUtc: string | null;
  updatedAtUtc: string | null;
};

export type EngBillingStatementLineDto = {
  id: string;
  workflowTaskId: string;
  propertyId: string | null;
  propertyLabel: string;
  poNumber: string;
  netFeeSar: number;
  billingStatus: string;
  billingStatusLabel: string;
};

export type EngBillingStatementDto = {
  id: string;
  referenceNumber: string;
  assigneeId: string;
  status: EngBillingStatementStatus;
  statusLabel: string;
  totalNetSar: number;
  createdByUserId: string;
  createdAtUtc: string;
  issuedAtUtc: string | null;
  closedAtUtc: string | null;
  externalInvoiceNumber: string | null;
  transferReceiptAttachmentId: string | null;
  transferReceiptRef: string | null;
  paidAtUtc: string | null;
  notes: string | null;
  lines: EngBillingStatementLineDto[];
};

export type CreateEngBillingStatementRequest = {
  workflowTaskIds: string[];
  deferUnselectedForAssignee?: boolean;
  notes?: string;
};

export type CreateEngBillingStatementResult = {
  statement: EngBillingStatementDto | null;
  deferredLines: EngBillingReadyLineDto[];
  error?: string | null;
};

export type CloseEngBillingStatementRequest = {
  externalInvoiceNumber: string;
  transferReceiptAttachmentId?: string;
  transferReceiptRef?: string;
  paidAtUtc?: string;
  notes?: string;
};

export type DeferEngBillingLinesRequest = {
  workflowTaskIds: string[];
};

export type DeferEngBillingLinesResult = {
  deferred: EngBillingReadyLineDto[];
  failed: { workflowTaskId: string; error: string }[];
};

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function normalizeReadyLine(raw: Record<string, unknown>): EngBillingReadyLineDto {
  return {
    workflowTaskId: String(raw.workflowTaskId ?? raw.WorkflowTaskId ?? ""),
    propertyId: (raw.propertyId ?? raw.PropertyId ?? null) as string | null,
    propertyLabel: String(raw.propertyLabel ?? raw.PropertyLabel ?? ""),
    poNumber: String(raw.poNumber ?? raw.PoNumber ?? ""),
    assigneeId: (raw.assigneeId ?? raw.AssigneeId ?? null) as string | null,
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
): EngBillingStatementLineDto {
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

function normalizeStatement(raw: Record<string, unknown>): EngBillingStatementDto {
  const linesRaw = (raw.lines ?? raw.Lines ?? []) as unknown[];
  return {
    id: String(raw.id ?? raw.Id ?? ""),
    referenceNumber: String(raw.referenceNumber ?? raw.ReferenceNumber ?? ""),
    assigneeId: String(raw.assigneeId ?? raw.AssigneeId ?? ""),
    status: String(raw.status ?? raw.Status ?? "draft") as EngBillingStatementStatus,
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
    paidAtUtc: (raw.paidAtUtc ?? raw.PaidAtUtc ?? null) as string | null,
    notes: (raw.notes ?? raw.Notes ?? null) as string | null,
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

export async function listEngBillingReadyLines(
  config: EngBillingStatementsApiConfig,
  assigneeId?: string,
): Promise<ApiOk<EngBillingReadyLineDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const qs = assigneeId
      ? `?assigneeId=${encodeURIComponent(assigneeId)}`
      : "";
    const res = await fetch(`${base}/api/eng-billing-statements/ready-lines${qs}`, {
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

export async function listEngBillingStatements(
  config: EngBillingStatementsApiConfig,
  query: {
    assigneeId?: string;
    status?: string;
    issuedOrLaterOnly?: boolean;
  } = {},
): Promise<ApiOk<EngBillingStatementDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/eng-billing-statements${queryString(query)}`,
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

export async function getEngBillingStatement(
  config: EngBillingStatementsApiConfig,
  statementId: string,
): Promise<ApiOk<EngBillingStatementDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/eng-billing-statements/${encodeURIComponent(statementId)}`,
      { headers: headers(config.token) },
    );
    if (!res.ok) return httpErr(res);
    return { ok: true, data: normalizeStatement(asRecord(await res.json())) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function createEngBillingStatement(
  config: EngBillingStatementsApiConfig,
  body: CreateEngBillingStatementRequest,
): Promise<ApiOk<CreateEngBillingStatementResult> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/eng-billing-statements`, {
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

export async function issueEngBillingStatement(
  config: EngBillingStatementsApiConfig,
  statementId: string,
): Promise<ApiOk<EngBillingStatementDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/eng-billing-statements/${encodeURIComponent(statementId)}/issue`,
      { method: "POST", headers: headers(config.token) },
    );
    if (!res.ok) return httpErr(res, await readError(res));
    return { ok: true, data: normalizeStatement(asRecord(await res.json())) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function closeEngBillingStatement(
  config: EngBillingStatementsApiConfig,
  statementId: string,
  body: CloseEngBillingStatementRequest,
): Promise<ApiOk<EngBillingStatementDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/eng-billing-statements/${encodeURIComponent(statementId)}/close`,
      {
        method: "POST",
        headers: headers(config.token),
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) return httpErr(res, await readError(res));
    return { ok: true, data: normalizeStatement(asRecord(await res.json())) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function deferEngBillingLines(
  config: EngBillingStatementsApiConfig,
  body: DeferEngBillingLinesRequest,
): Promise<ApiOk<DeferEngBillingLinesResult> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/eng-billing-statements/defer-lines`, {
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

export function engBillingStatementStatusTone(
  status: EngBillingStatementStatus,
): "default" | "warning" | "success" | "info" {
  switch (status) {
    case "draft":
      return "default";
    case "issued":
      return "info";
    case "closed":
      return "success";
    default:
      return "default";
  }
}
