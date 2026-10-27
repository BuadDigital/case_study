/**
 * Inspector fees API — per-property fee ledger persisted in PostgreSQL.
 */
import { normalizeFieldErrors } from "./field-errors";
import { authHeaders, getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import { readErrorText } from "./parse-json";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

/** Prefer field errors when present; otherwise surface `{ error }` like eng-billing. */
async function readMutationError(res: Response): Promise<ApiErr> {
  try {
    const body = (await res.json()) as {
      errors?: Record<string, string | string[]>;
      error?: unknown;
      Error?: unknown;
    };
    const fieldErrors = normalizeFieldErrors(body.errors);
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, kind: "validation", errors: fieldErrors };
    }
    const message = String(
      body.error ?? body.Error ?? `HTTP ${res.status}`,
    );
    return { ok: false, kind: "server", message };
  } catch {
    return { ok: false, kind: "server", message: `HTTP ${res.status}` };
  }
}

export type InspectorFeesApiConfig = WorkOrdersApiConfig;

/**
 * Fee line lifecycle. An engineering-survey line in `sup-review` is waiting on the specialist's
 * proposed discount (see `proposedDiscountSar`) until the department supervisor decides it. The
 * office approve / dispute states (`office-review`, `disputed`) are retired — the office is told
 * about a proposed discount, never asked.
 */
export type InspectorFeeBillingStatus =
  | "draft"
  | "sup-review"
  | "at-finance"
  | "deferred"
  | "in-statement"
  | "disb-req"
  | "disbursed"
  | "returned"
  | "inquiry"
  | "suspended";

export type InspectorFeeWorkStatus = "in_progress" | "done" | "cancelled";

/** Status-machine actions. Proposed-discount decisions use `resolveDiscountProposal`, not these. */
export type InspectorFeeAction =
  | "submit-to-supervisor"
  | "approve-to-finance"
  | "resend-to-finance"
  | "return-to-office"
  | "create-disbursement-request"
  | "disburse"
  | "return-to-supervisor"
  | "inquiry-to-office"
  | "suspend"
  | "lift-suspension";

export type InspectorFeeRowDto = {
  id: string;
  workflowTaskId: string;
  propertyId: string | null;
  propertyLabel: string;
  poNumber: string;
  assigneeId: string | null;
  taskKind: string;
  supervisingDepartment: "case_study" | "valuation" | "finance_dept" | "external";
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
  paidAmountSar: number;
  billingStatus: InspectorFeeBillingStatus;
  billingStatusLabel: string;
  workStatus: InspectorFeeWorkStatus;
  workStatusLabel: string;
  excludedFromBatch: boolean;
  exclusionReason: string | null;
  returnTo: string | null;
  disbursementBatchId: string | null;
  disbursementVoucher: string | null;
  partyBillingStatementId: string | null;
  lastTransitionReason: string | null;
  updatedAtUtc: string | null;
  accruedAtUtc: string | null;
  workSubmittedAtUtc: string | null;
  poReceivedAtUtc: string | null;
  suspensionReason: string | null;
  isEditable: boolean;
  canSubmitToSupervisor: boolean;
  canApproveToFinance: boolean;
  canCreateDisbursementRequest: boolean;
  /** The specialist's discount proposal still waiting for the supervisor; null when none. */
  proposedDiscountSar: number | null;
  proposedDiscountReason: string | null;
  proposedByName: string | null;
  proposedAtUtc: string | null;
  canResolveDiscountProposal: boolean;
  canSuspend: boolean;
  canLiftSuspension: boolean;
};

export type InspectorFeesSummaryDto = {
  netDraftSar: number;
  supReviewSar: number;
  atFinanceSar: number;
  disbReqSar: number;
  disbursedSar: number;
  suspendedSar: number;
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

/** The supervisor's decision on a proposed discount. */
export type DiscountProposalDecision = "approve" | "amend" | "waive";

export type ResolveDiscountProposalRequest = {
  decision: DiscountProposalDecision;
  /** Required for amend. */
  amountSar?: number;
  note?: string;
};

export type WaivePartyFeesRequest = {
  assigneeId: string;
  reason: string;
};

/** How many lines were cancelled, and the ones left for finance (in a statement, paid or suspended). */
export type WaivePartyFeesResultDto = {
  waivedCount: number;
  skipped: {
    workflowTaskId: string;
    propertyId: string;
    billingStatus: InspectorFeeBillingStatus;
    billingStatusLabel: string;
  }[];
};

export type InspectorFeeTransitionRequest = {
  action: InspectorFeeAction;
  reason?: string;
  disbursementVoucher?: string;
};

export type ListInspectorFeesQuery = {
  assigneeId?: string;
  workflowTaskId?: string;
  submittedOnly?: boolean;
  taskKind?: string;
  billingStatus?: InspectorFeeBillingStatus;
  returnTo?: "supervisor" | "office";
};

function normalizeRow(raw: Record<string, unknown>): InspectorFeeRowDto {
  return {
    id: String(raw.id ?? raw.Id ?? ""),
    workflowTaskId: String(raw.workflowTaskId ?? raw.WorkflowTaskId ?? ""),
    propertyId: (raw.propertyId ?? raw.PropertyId ?? null) as string | null,
    propertyLabel: String(raw.propertyLabel ?? raw.PropertyLabel ?? ""),
    poNumber: String(raw.poNumber ?? raw.PoNumber ?? ""),
    assigneeId: (raw.assigneeId ?? raw.AssigneeId ?? null) as string | null,
    taskKind: String(raw.taskKind ?? raw.TaskKind ?? ""),
    supervisingDepartment: (raw.supervisingDepartment ??
      raw.SupervisingDepartment ??
      "case_study") as InspectorFeeRowDto["supervisingDepartment"],
    inspectorType: String(raw.inspectorType ?? raw.InspectorType ?? "موظف"),
    agreedFeeSar: Number(raw.agreedFeeSar ?? raw.AgreedFeeSar ?? 0),
    supervisorDiscountSar: Number(
      raw.supervisorDiscountSar ?? raw.SupervisorDiscountSar ?? 0,
    ),
    discountReason:
      (raw.discountReason ?? raw.DiscountReason ?? null) as string | null,
    netFeeSar: Number(raw.netFeeSar ?? raw.NetFeeSar ?? 0),
    paidAmountSar: Number(raw.paidAmountSar ?? raw.PaidAmountSar ?? 0),
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
    partyBillingStatementId: (raw.partyBillingStatementId ??
      raw.PartyBillingStatementId ??
      raw.engineeringBillingStatementId ??
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
    // Kept null (not 0) when absent: `null` means "no proposal waiting", while 0 would read as a
    // proposal of zero and show a proposal line on every row.
    proposedDiscountSar:
      raw.proposedDiscountSar == null && raw.ProposedDiscountSar == null
        ? null
        : Number(raw.proposedDiscountSar ?? raw.ProposedDiscountSar),
    proposedDiscountReason: (raw.proposedDiscountReason ??
      raw.ProposedDiscountReason ??
      null) as string | null,
    proposedByName: (raw.proposedByName ?? raw.ProposedByName ?? null) as
      | string
      | null,
    proposedAtUtc: (raw.proposedAtUtc ?? raw.ProposedAtUtc ?? null) as
      | string
      | null,
    canResolveDiscountProposal: Boolean(
      raw.canResolveDiscountProposal ?? raw.CanResolveDiscountProposal ?? false,
    ),
    suspensionReason:
      (raw.suspensionReason ?? raw.SuspensionReason ?? null) as string | null,
    canSuspend: Boolean(raw.canSuspend ?? raw.CanSuspend ?? false),
    canLiftSuspension: Boolean(
      raw.canLiftSuspension ?? raw.CanLiftSuspension ?? false,
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
    suspendedSar: Number(raw.suspendedSar ?? raw.SuspendedSar ?? 0),
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
      headers: authHeaders(config.token),
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
      headers: authHeaders(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return readMutationError(res);
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
        headers: authHeaders(config.token),
        body: JSON.stringify(body),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) {
      return { ok: false, kind: "server", message: await readErrorText(res) };
    }
    const raw = (await res.json()) as Record<string, unknown>;
    return { ok: true, data: normalizeRow(raw) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/**
 * POSTs a fee command under `/api/inspector-fees` and maps the reply: auth for 401/403, not
 * found for 404, the server's message for any other failure.
 *
 * How it works: one fetch with the JSON body, then the status is mapped to the shared
 * `ApiOk` / `ApiErr` shape and a successful body goes through `read`.
 *
 * Why it exists: the decision and the cancellation had the same 20-line fetch body, which the
 * duplicate detector flagged; both now share this and only differ by path and reader. A network
 * failure resolves to `kind: "network"` instead of throwing, like every other client here.
 */
async function postFeeCommand<T>(
  config: InspectorFeesApiConfig,
  path: string,
  body: unknown,
  read: (raw: Record<string, unknown>) => T,
): Promise<ApiOk<T> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/inspector-fees/${path}`, {
      method: "POST",
      headers: authHeaders(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401 || res.status === 403) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) {
      return { ok: false, kind: "server", message: await readErrorText(res) };
    }
    return { ok: true, data: read((await res.json()) as Record<string, unknown>) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/**
 * Supervisor: approve, amend or waive the specialist's proposed discount.
 *
 * `amountSar` is only read for `amend`. A refused decision (wrong department, amend to zero or
 * above the fee, no pending proposal) comes back as `kind: "server"` with the Arabic reason.
 * The reply is the updated fee row (now at finance), normalised like a list row.
 */
export function resolveDiscountProposal(
  config: InspectorFeesApiConfig,
  workflowTaskId: string,
  body: ResolveDiscountProposalRequest,
): Promise<ApiOk<InspectorFeeRowDto> | ApiErr> {
  return postFeeCommand(
    config,
    `${workflowTaskId}/discount-proposal/resolve`,
    body,
    normalizeRow,
  );
}

/**
 * Supervisor: cancel one party's whole fee on a transaction.
 *
 * The PO is URI-encoded (PO numbers are free text). Edge case: lines already in a statement,
 * paid or suspended are not cancelled — they come back in `skipped` so the caller can say so.
 */
export function waivePartyFees(
  config: InspectorFeesApiConfig,
  poNumber: string,
  body: WaivePartyFeesRequest,
): Promise<ApiOk<WaivePartyFeesResultDto> | ApiErr> {
  return postFeeCommand(
    config,
    `transactions/${encodeURIComponent(poNumber.trim())}/waive-party`,
    body,
    (raw) => ({
      waivedCount: Number(raw.waivedCount ?? 0),
      skipped: (raw.skipped ?? []) as WaivePartyFeesResultDto["skipped"],
    }),
  );
}

export function inspectorFeeStatusLabel(
  status: InspectorFeeBillingStatus,
): string {
  switch (status) {
    case "draft":
      return "مستحق";
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
    case "suspended":
      return "موقوف";
    default:
      return "—";
  }
}

export function inspectorFeeStatusTone(
  status: InspectorFeeBillingStatus,
): "default" | "warning" | "success" | "danger" | "info" {
  switch (status) {
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
    case "suspended":
      return "warning";
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