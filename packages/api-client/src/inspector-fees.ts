/**
 * Inspector fees API — per-property fee ledger persisted in PostgreSQL.
 */
import { parseFieldErrorsFromResponse } from "./field-errors";
import { getApiBase } from "./index";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

export type InspectorFeesApiConfig = WorkOrdersApiConfig;

export type InspectorFeeBillingStatus =
  | "pre-billing"
  | "ready-for-billing"
  | "invoiced"
  | "paid"
  | "returned";

export type InspectorFeeAction =
  | "submit-to-finance"
  | "invoice"
  | "record-payment"
  | "return";

export type InspectorFeeRowDto = {
  workflowTaskId: string;
  propertyId: string | null;
  propertyLabel: string;
  poNumber: string;
  inspectorType: "متعاون" | "موظف" | string;
  agreedFeeSar: number;
  supervisorDiscountSar: number;
  discountReason: string | null;
  netFeeSar: number;
  billingStatus: InspectorFeeBillingStatus;
  billingStatusLabel: string;
  excludedFromBatch: boolean;
  exclusionReason: string | null;
  invoiceNumber: string | null;
  isEditable: boolean;
};

export type InspectorFeesSummaryDto = {
  netPreBillingSar: number;
  readyForBillingSar: number;
  totalDiscountsSar: number;
  invoicedSar: number;
  paidSar: number;
  rows: InspectorFeeRowDto[];
};

export type PatchInspectorFeeRequest = {
  supervisorDiscountSar?: number;
  discountReason?: string;
  agreedFeeSar?: number;
  excludedFromBatch?: boolean;
  exclusionReason?: string;
};

export type InspectorFeeTransitionRequest = {
  action: InspectorFeeAction;
  reason?: string;
  invoiceNumber?: string;
};

export type BatchInspectorFeeTransitionRequest = {
  workflowTaskIds: string[];
  action: InspectorFeeAction;
  reason?: string;
  invoiceNumber?: string;
};

export type BatchInspectorFeeTransitionResult = {
  succeeded: InspectorFeeRowDto[];
  failed: { workflowTaskId: string; error: string }[];
};

export type ListInspectorFeesQuery = {
  assigneeId?: string;
  workflowTaskId?: string;
  submittedOnly?: boolean;
  /** field-inspection | engineering-survey */
  taskKind?: string;
  billingStatus?: InspectorFeeBillingStatus;
};

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function normalizeRow(raw: Record<string, unknown>): InspectorFeeRowDto {
  return {
    workflowTaskId: String(raw.workflowTaskId ?? raw.WorkflowTaskId ?? ""),
    propertyId: (raw.propertyId ?? raw.PropertyId ?? null) as string | null,
    propertyLabel: String(raw.propertyLabel ?? raw.PropertyLabel ?? ""),
    poNumber: String(raw.poNumber ?? raw.PoNumber ?? ""),
    inspectorType: String(raw.inspectorType ?? raw.InspectorType ?? "موظف"),
    agreedFeeSar: Number(raw.agreedFeeSar ?? raw.AgreedFeeSar ?? 0),
    supervisorDiscountSar: Number(
      raw.supervisorDiscountSar ?? raw.SupervisorDiscountSar ?? 0,
    ),
    discountReason:
      (raw.discountReason ?? raw.DiscountReason ?? null) as string | null,
    netFeeSar: Number(raw.netFeeSar ?? raw.NetFeeSar ?? 0),
    billingStatus: (raw.billingStatus ?? raw.BillingStatus ?? "pre-billing") as
      InspectorFeeBillingStatus,
    billingStatusLabel: String(
      raw.billingStatusLabel ?? raw.BillingStatusLabel ?? "",
    ),
    excludedFromBatch: Boolean(
      raw.excludedFromBatch ?? raw.ExcludedFromBatch ?? false,
    ),
    exclusionReason:
      (raw.exclusionReason ?? raw.ExclusionReason ?? null) as string | null,
    invoiceNumber:
      (raw.invoiceNumber ?? raw.InvoiceNumber ?? null) as string | null,
    isEditable: Boolean(raw.isEditable ?? raw.IsEditable ?? false),
  };
}

function normalizeSummary(raw: Record<string, unknown>): InspectorFeesSummaryDto {
  const rowsRaw = (raw.rows ?? raw.Rows ?? []) as Record<string, unknown>[];
  return {
    netPreBillingSar: Number(raw.netPreBillingSar ?? raw.NetPreBillingSar ?? 0),
    readyForBillingSar: Number(
      raw.readyForBillingSar ?? raw.ReadyForBillingSar ?? 0,
    ),
    totalDiscountsSar: Number(
      raw.totalDiscountsSar ?? raw.TotalDiscountsSar ?? 0,
    ),
    invoicedSar: Number(raw.invoicedSar ?? raw.InvoicedSar ?? 0),
    paidSar: Number(raw.paidSar ?? raw.PaidSar ?? 0),
    rows: rowsRaw.map(normalizeRow),
  };
}

function queryString(query: ListInspectorFeesQuery): string {
  const params = new URLSearchParams();
  if (query.assigneeId?.trim()) params.set("assigneeId", query.assigneeId.trim());
  if (query.workflowTaskId?.trim())
    params.set("workflowTaskId", query.workflowTaskId.trim());
  if (query.submittedOnly !== undefined)
    params.set("submittedOnly", String(query.submittedOnly));
  if (query.taskKind?.trim()) params.set("taskKind", query.taskKind.trim());
  if (query.billingStatus?.trim())
    params.set("billingStatus", query.billingStatus.trim());
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function listInspectorFees(
  config: InspectorFeesApiConfig,
  query: ListInspectorFeesQuery = {},
): Promise<ApiOk<InspectorFeesSummaryDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/inspector-fees${queryString(query)}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>;
    return { ok: true, data: normalizeSummary(raw) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function patchInspectorFee(
  config: InspectorFeesApiConfig,
  workflowTaskId: string,
  body: PatchInspectorFeeRequest,
): Promise<ApiOk<InspectorFeeRowDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/inspector-fees/${workflowTaskId}`, {
      method: "PATCH",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) {
      const fieldErrors = await parseFieldErrorsFromResponse(res);
      if (fieldErrors) {
        return {
          ok: false,
          kind: "validation",
          errors: fieldErrors,
        };
      }
      return { ok: false, kind: "server" };
    }
    const raw = (await res.json()) as Record<string, unknown>;
    return { ok: true, data: normalizeRow(raw) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function transitionInspectorFee(
  config: InspectorFeesApiConfig,
  workflowTaskId: string,
  body: InspectorFeeTransitionRequest,
): Promise<ApiOk<InspectorFeeRowDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/inspector-fees/${workflowTaskId}/transition`,
      {
        method: "POST",
        headers: headers(config.token),
        body: JSON.stringify(body),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>;
    return { ok: true, data: normalizeRow(raw) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function batchTransitionInspectorFees(
  config: InspectorFeesApiConfig,
  body: BatchInspectorFeeTransitionRequest,
): Promise<ApiOk<BatchInspectorFeeTransitionResult> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/inspector-fees/batch-transition`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>;
    const succeededRaw = (raw.succeeded ?? raw.Succeeded ?? []) as Record<
      string,
      unknown
    >[];
    const failedRaw = (raw.failed ?? raw.Failed ?? []) as Record<
      string,
      unknown
    >[];
    return {
      ok: true,
      data: {
        succeeded: succeededRaw.map(normalizeRow),
        failed: failedRaw.map((item) => ({
          workflowTaskId: String(
            item.workflowTaskId ?? item.WorkflowTaskId ?? "",
          ),
          error: String(item.error ?? item.Error ?? ""),
        })),
      },
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export function inspectorFeeStatusLabel(
  status: InspectorFeeBillingStatus,
): string {
  switch (status) {
    case "ready-for-billing":
      return "جاهزة للفوترة";
    case "invoiced":
      return "مفوترة";
    case "paid":
      return "مدفوعة";
    case "returned":
      return "مُرجعة باعتراض";
    default:
      return "قبل الفوترة";
  }
}

export function inspectorFeeStatusTone(
  status: InspectorFeeBillingStatus,
): "default" | "warning" | "success" | "danger" | "info" {
  switch (status) {
    case "ready-for-billing":
      return "info";
    case "invoiced":
      return "warning";
    case "paid":
      return "success";
    case "returned":
      return "danger";
    default:
      return "default";
  }
}
