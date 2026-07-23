/**
 * Inspector fees API — per-property fee ledger persisted in PostgreSQL.
 */
import { parseFieldErrorsFromResponse } from "./field-errors";
import { getApiBase } from "./index";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

export type InspectorFeesApiConfig = WorkOrdersApiConfig;

export type InspectorFeeBillingStatus =
  | "draft"
  | "office-review"
  | "disputed"
  | "sup-review"
  | "at-finance"
  | "deferred"
  | "in-statement"
  | "disb-req"
  | "disbursed"
  | "returned"
  | "inquiry";

export type InspectorFeeWorkStatus = "in_progress" | "done" | "cancelled";

export type InspectorFeeAction =
  | "submit-to-supervisor"
  | "office-approve-discount"
  | "office-dispute"
  | "resolve-dispute"
  | "approve-to-finance"
  | "resend-to-finance"
  | "return-to-office"
  | "create-disbursement-request"
  | "disburse"
  | "return-to-supervisor"
  | "inquiry-to-office";

export type InspectorFeeRowDto = {
  workflowTaskId: string;
  propertyId: string | null;
  propertyLabel: string;
  poNumber: string;
  assigneeId: string | null;
  taskKind: string;
  inspectorType:
    | "متعاون فرد"
    | "متعاون شركة"
    | "متعاون"
    | "موظف"
    | string;
  agreedFeeSar: number;
  supervisorDiscountSar: number;
  discountReason: string | null;
  netFeeSar: number;
  billingStatus: InspectorFeeBillingStatus;
  billingStatusLabel: string;
  workStatus: InspectorFeeWorkStatus;
  workStatusLabel: string;
  excludedFromBatch: boolean;
  exclusionReason: string | null;
  returnTo: string | null;
  disbursementBatchId: string | null;
  disbursementVoucher: string | null;
  engineeringBillingStatementId: string | null;
  lastTransitionReason: string | null;
  updatedAtUtc: string | null;
  accruedAtUtc: string | null;
  workSubmittedAtUtc: string | null;
  poReceivedAtUtc: string | null;
  isEditable: boolean;
  canSubmitToSupervisor: boolean;
  canApproveToFinance: boolean;
  canCreateDisbursementRequest: boolean;
  canOfficeApproveDiscount: boolean;
  canOfficeDispute: boolean;
  canResolveDispute: boolean;
};

export type InspectorFeesSummaryDto = {
  netDraftSar: number;
  supReviewSar: number;
  atFinanceSar: number;
  disbReqSar: number;
  disbursedSar: number;
  totalDiscountsSar: number;
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
  disbursementVoucher?: string;
};

export type BatchInspectorFeeTransitionRequest = {
  workflowTaskIds: string[];
  action: InspectorFeeAction;
  reason?: string;
  disbursementVoucher?: string;
  disbursementBatchId?: string;
};

export type BatchInspectorFeeTransitionResult = {
  succeeded: InspectorFeeRowDto[];
  failed: { workflowTaskId: string; error: string }[];
  disbursementBatchId?: string | null;
};

export type CreateDisbursementBatchRequest = {
  workflowTaskIds: string[];
};

export type CreateDisbursementBatchResult = {
  disbursementBatchId: string;
  rows: InspectorFeeRowDto[];
  failed: { workflowTaskId: string; error: string }[];
};

export type InspectorFeeAuditEntryDto = {
  id: string;
  fromStatus: string;
  fromStatusLabel: string;
  toStatus: string;
  toStatusLabel: string;
  reason: string | null;
  actorUserId: string;
  actorLabel: string | null;
  createdAtUtc: string;
};

export type ListInspectorFeesQuery = {
  assigneeId?: string;
  workflowTaskId?: string;
  submittedOnly?: boolean;
  taskKind?: string;
  billingStatus?: InspectorFeeBillingStatus;
  returnTo?: "supervisor" | "office";
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
    assigneeId: (raw.assigneeId ?? raw.AssigneeId ?? null) as string | null,
    taskKind: String(raw.taskKind ?? raw.TaskKind ?? ""),
    inspectorType: String(raw.inspectorType ?? raw.InspectorType ?? "موظف"),
    agreedFeeSar: Number(raw.agreedFeeSar ?? raw.AgreedFeeSar ?? 0),
    supervisorDiscountSar: Number(
      raw.supervisorDiscountSar ?? raw.SupervisorDiscountSar ?? 0,
    ),
    discountReason:
      (raw.discountReason ?? raw.DiscountReason ?? null) as string | null,
    netFeeSar: Number(raw.netFeeSar ?? raw.NetFeeSar ?? 0),
    billingStatus: (raw.billingStatus ?? raw.BillingStatus ?? "draft") as
      InspectorFeeBillingStatus,
    billingStatusLabel: String(
      raw.billingStatusLabel ?? raw.BillingStatusLabel ?? "",
    ),
    workStatus: (raw.workStatus ?? raw.WorkStatus ?? "in_progress") as
      InspectorFeeWorkStatus,
    workStatusLabel: String(
      raw.workStatusLabel ?? raw.WorkStatusLabel ?? "",
    ),
    excludedFromBatch: Boolean(
      raw.excludedFromBatch ?? raw.ExcludedFromBatch ?? false,
    ),
    exclusionReason:
      (raw.exclusionReason ?? raw.ExclusionReason ?? null) as string | null,
    returnTo: (raw.returnTo ?? raw.ReturnTo ?? null) as string | null,
    disbursementBatchId: (raw.disbursementBatchId ??
      raw.DisbursementBatchId ??
      null) as string | null,
    disbursementVoucher: (raw.disbursementVoucher ??
      raw.DisbursementVoucher ??
      null) as string | null,
    engineeringBillingStatementId: (raw.engineeringBillingStatementId ??
      raw.EngineeringBillingStatementId ??
      null) as string | null,
    lastTransitionReason: (raw.lastTransitionReason ??
      raw.LastTransitionReason ??
      null) as string | null,
    updatedAtUtc: (raw.updatedAtUtc ?? raw.UpdatedAtUtc ?? null) as string | null,
    accruedAtUtc: (raw.accruedAtUtc ?? raw.AccruedAtUtc ?? null) as string | null,
    workSubmittedAtUtc: (raw.workSubmittedAtUtc ??
      raw.WorkSubmittedAtUtc ??
      null) as string | null,
    poReceivedAtUtc: (raw.poReceivedAtUtc ?? raw.PoReceivedAtUtc ?? null) as
      | string
      | null,
    isEditable: Boolean(raw.isEditable ?? raw.IsEditable ?? false),
    canSubmitToSupervisor: Boolean(
      raw.canSubmitToSupervisor ?? raw.CanSubmitToSupervisor ?? false,
    ),
    canApproveToFinance: Boolean(
      raw.canApproveToFinance ?? raw.CanApproveToFinance ?? false,
    ),
    canCreateDisbursementRequest: Boolean(
      raw.canCreateDisbursementRequest ?? raw.CanCreateDisbursementRequest ?? false,
    ),
    canOfficeApproveDiscount: Boolean(
      raw.canOfficeApproveDiscount ?? raw.CanOfficeApproveDiscount ?? false,
    ),
    canOfficeDispute: Boolean(
      raw.canOfficeDispute ?? raw.CanOfficeDispute ?? false,
    ),
    canResolveDispute: Boolean(
      raw.canResolveDispute ?? raw.CanResolveDispute ?? false,
    ),
  };
}

function normalizeSummary(raw: Record<string, unknown>): InspectorFeesSummaryDto {
  const rowsRaw = (raw.rows ?? raw.Rows ?? []) as Record<string, unknown>[];
  return {
    netDraftSar: Number(raw.netDraftSar ?? raw.NetDraftSar ?? 0),
    supReviewSar: Number(raw.supReviewSar ?? raw.SupReviewSar ?? 0),
    atFinanceSar: Number(raw.atFinanceSar ?? raw.AtFinanceSar ?? 0),
    disbReqSar: Number(raw.disbReqSar ?? raw.DisbReqSar ?? 0),
    disbursedSar: Number(raw.disbursedSar ?? raw.DisbursedSar ?? 0),
    totalDiscountsSar: Number(
      raw.totalDiscountsSar ?? raw.TotalDiscountsSar ?? 0,
    ),
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
  if (query.returnTo?.trim()) params.set("returnTo", query.returnTo.trim());
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
        return { ok: false, kind: "validation", errors: fieldErrors };
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
        disbursementBatchId: (raw.disbursementBatchId ??
          raw.DisbursementBatchId ??
          null) as string | null,
      },
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function createDisbursementBatch(
  config: InspectorFeesApiConfig,
  body: CreateDisbursementBatchRequest,
): Promise<ApiOk<CreateDisbursementBatchResult> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/inspector-fees/disbursement-batch`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>;
    const rowsRaw = (raw.rows ?? raw.Rows ?? []) as Record<string, unknown>[];
    const failedRaw = (raw.failed ?? raw.Failed ?? []) as Record<
      string,
      unknown
    >[];
    return {
      ok: true,
      data: {
        disbursementBatchId: String(
          raw.disbursementBatchId ?? raw.DisbursementBatchId ?? "",
        ),
        rows: rowsRaw.map(normalizeRow),
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

export async function listInspectorFeeTransitions(
  config: InspectorFeesApiConfig,
  workflowTaskId: string,
): Promise<ApiOk<InspectorFeeAuditEntryDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/inspector-fees/${encodeURIComponent(workflowTaskId)}/transitions`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>[];
    return {
      ok: true,
      data: raw.map((item) => ({
        id: String(item.id ?? item.Id ?? ""),
        fromStatus: String(item.fromStatus ?? item.FromStatus ?? ""),
        fromStatusLabel: String(
          item.fromStatusLabel ?? item.FromStatusLabel ?? "",
        ),
        toStatus: String(item.toStatus ?? item.ToStatus ?? ""),
        toStatusLabel: String(item.toStatusLabel ?? item.ToStatusLabel ?? ""),
        reason: (item.reason ?? item.Reason ?? null) as string | null,
        actorUserId: String(item.actorUserId ?? item.ActorUserId ?? ""),
        actorLabel: (item.actorLabel ?? item.ActorLabel ?? null) as
          | string
          | null,
        createdAtUtc: String(item.createdAtUtc ?? item.CreatedAtUtc ?? ""),
      })),
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export function inspectorFeeStatusLabel(
  status: InspectorFeeBillingStatus,
): string {
  switch (status) {
    case "office-review":
      return "بانتظار موافقة المكتب";
    case "disputed":
      return "خلاف تسعير";
    case "sup-review":
      return "بانتظار اعتماد المشرف";
    case "at-finance":
      return "جاهز للفوترة";
    case "deferred":
      return "جاهز — مرحَّل";
    case "in-statement":
      return "مدرج";
    case "disb-req":
      return "ضمن أمر صرف";
    case "disbursed":
      return "مفوترة / مدفوعة";
    case "returned":
      return "مُعاد للتعديل";
    case "inquiry":
      return "استفسار مفتوح";
    default:
      return "مستحق";
  }
}

export function inspectorFeeStatusTone(
  status: InspectorFeeBillingStatus,
): "default" | "warning" | "success" | "danger" | "info" {
  switch (status) {
    case "office-review":
      return "warning";
    case "disputed":
      return "danger";
    case "sup-review":
      return "warning";
    case "at-finance":
      return "info";
    case "deferred":
      return "warning";
    case "in-statement":
    case "disb-req":
      return "info";
    case "disbursed":
      return "success";
    case "returned":
    case "inquiry":
      return "danger";
    default:
      return "default";
  }
}

export function inspectorFeeWorkStatusTone(
  status: InspectorFeeWorkStatus,
): "default" | "warning" | "success" | "danger" {
  switch (status) {
    case "done":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "warning";
  }
}