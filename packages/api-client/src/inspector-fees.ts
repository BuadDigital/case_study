/**
 * Inspector fees API — per-property fee ledger persisted in PostgreSQL.
 */
import { parseFieldErrorsFromResponse } from "./field-errors";
import { getApiBase } from "./index";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

export type InspectorFeesApiConfig = WorkOrdersApiConfig;

export type InspectorFeeBillingStatus = "pre-billing" | "invoiced";

export type InspectorFeeRowDto = {
  workflowTaskId: string;
  propertyLabel: string;
  poNumber: string;
  inspectorType: "متعاون" | "موظف";
  agreedFeeSar: number;
  supervisorDiscountSar: number;
  discountReason: string | null;
  netFeeSar: number;
  billingStatus: InspectorFeeBillingStatus;
};

export type InspectorFeesSummaryDto = {
  netPreBillingSar: number;
  totalDiscountsSar: number;
  invoicedSar: number;
  rows: InspectorFeeRowDto[];
};

export type PatchInspectorFeeRequest = {
  supervisorDiscountSar?: number;
  discountReason?: string;
  billingStatus?: InspectorFeeBillingStatus;
  agreedFeeSar?: number;
};

export type ListInspectorFeesQuery = {
  assigneeId?: string;
  workflowTaskId?: string;
  submittedOnly?: boolean;
  /** field-inspection | engineering-survey */
  taskKind?: string;
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
    propertyLabel: String(raw.propertyLabel ?? raw.PropertyLabel ?? ""),
    poNumber: String(raw.poNumber ?? raw.PoNumber ?? ""),
    inspectorType: (raw.inspectorType ?? raw.InspectorType ?? "موظف") as
      | "متعاون"
      | "موظف",
    agreedFeeSar: Number(raw.agreedFeeSar ?? raw.AgreedFeeSar ?? 0),
    supervisorDiscountSar: Number(
      raw.supervisorDiscountSar ?? raw.SupervisorDiscountSar ?? 0,
    ),
    discountReason:
      (raw.discountReason ?? raw.DiscountReason ?? null) as string | null,
    netFeeSar: Number(raw.netFeeSar ?? raw.NetFeeSar ?? 0),
    billingStatus: (raw.billingStatus ?? raw.BillingStatus ?? "pre-billing") as
      InspectorFeeBillingStatus,
  };
}

function normalizeSummary(raw: Record<string, unknown>): InspectorFeesSummaryDto {
  const rowsRaw = (raw.rows ?? raw.Rows ?? []) as Record<string, unknown>[];
  return {
    netPreBillingSar: Number(raw.netPreBillingSar ?? raw.NetPreBillingSar ?? 0),
    totalDiscountsSar: Number(
      raw.totalDiscountsSar ?? raw.TotalDiscountsSar ?? 0,
    ),
    invoicedSar: Number(raw.invoicedSar ?? raw.InvoicedSar ?? 0),
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

export function inspectorFeeStatusLabel(
  status: InspectorFeeBillingStatus,
): string {
  return status === "invoiced" ? "مفوتر" : "قبل الفوترة";
}
