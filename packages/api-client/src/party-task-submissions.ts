/**
 * Party task submissions API — persists party work (survey, appraisal, gov review, coordination, field inspection).
 * GET/PUT /api/party-task-submissions/{taskId}; POST .../submit completes the workflow child task; POST .../reopen (engineering, appraisal, field-inspection).
 */
import { parseFieldErrorsFromResponse } from "./field-errors";
import { getApiBase } from "./api-base";
import { withIdempotencyKey } from "./idempotency-key";
import { repositoryFetch as fetch } from "./write-repository";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

/** Who wrote / last edited one payload field (server-stamped from the caller's identity). */
export type PartyFieldProvenanceEntry = {
  writtenByUserId?: string;
  writtenByName?: string;
  writtenByRole?: string;
  writtenAtUtc?: string;
  editedByUserId?: string;
  editedByName?: string;
  editedByRole?: string;
  editedAtUtc?: string;
};

export type PartyTaskSubmissionDto = {
  id?: string;
  taskId: string;
  kind: string;
  status: string;
  propertyId?: string;
  poNumber?: string;
  payload: Record<string, unknown>;
  returnNote?: string;
  submittedAtUtc?: string;
  acceptedAtUtc?: string;
  submittedByUserId?: string;
  submittedByName?: string;
  acceptedByUserId?: string;
  acceptedByName?: string;
  reopenedByUserId?: string;
  reopenedByName?: string;
  updatedAtUtc: string;
  /** Engineering-survey / property-appraisal: sibling field-inspection completed (server). */
  fieldInspectionCompleted?: boolean | null;
  /** Property-appraisal: sibling inspection package specialist-accepted (server). */
  fieldInspectionAccepted?: boolean | null;
  /** Property-appraisal: the specialist's study report is issued (server) — opens the appraiser's submit. */
  studyReportIssued?: boolean | null;
  /**
   * Field-inspection: the server's fingerprint of the specialist-owned source data.
   * The inspector's device echoes it back with each save (spec §4.4).
   */
  sourceFingerprint?: string;
  /**
   * Property-appraisal: fingerprint of the inspector's data as the server sees it now. The appraiser
   * acknowledges it by saving it into his own draft payload as `inspectorDataSeen`.
   */
  inspectorDataFingerprint?: string;
  /**
   * Property-appraisal: inspector-data groups that changed since the fingerprint the appraiser last
   * acknowledged (`assetType, components, area, age, boundaries, location, photos, narrative,
   * services`). Empty / absent on the first open (no baseline yet).
   */
  inspectorDataChangedGroups?: string[];
  /**
   * Payload key → writer / latest editor. Keys are top-level payload keys, or `parent.child`
   * for one level of nesting (e.g. `featureValues.assetSubject`).
   */
  fieldProvenance?: Record<string, PartyFieldProvenanceEntry>;
};

export type SavePartyTaskSubmissionRequest = {
  payload: Record<string, unknown>;
};

async function parseSaveFailure(
  res: Response,
): Promise<ApiErr & { errors?: Record<string, string> }> {
  if (res.status === 403) {
    const errors = await parseFieldErrorsFromResponse(res);
    return { ok: false, kind: "forbidden", errors, message: errors._ };
  }
  if (res.status === 400) {
    const errors = await parseFieldErrorsFromResponse(res);
    return { ok: false, kind: "validation", errors };
  }
  return { ok: false, kind: "server" };
}

export type ReopenPartyTaskSubmissionRequest = {
  returnNote: string;
};

function headers(token: string, idempotencyKey?: string): HeadersInit {
  const base = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  return idempotencyKey ? withIdempotencyKey(base, idempotencyKey) : base;
}

function normalizeProvenanceEntry(raw: unknown): PartyFieldProvenanceEntry {
  const row = (raw ?? {}) as Record<string, unknown>;
  const str = (a: string, b: string) => {
    const v = row[a] ?? row[b];
    return typeof v === "string" && v.trim() ? v : undefined;
  };
  return {
    writtenByUserId: str("writtenByUserId", "WrittenByUserId"),
    writtenByName: str("writtenByName", "WrittenByName"),
    writtenByRole: str("writtenByRole", "WrittenByRole"),
    writtenAtUtc: str("writtenAtUtc", "WrittenAtUtc"),
    editedByUserId: str("editedByUserId", "EditedByUserId"),
    editedByName: str("editedByName", "EditedByName"),
    editedByRole: str("editedByRole", "EditedByRole"),
    editedAtUtc: str("editedAtUtc", "EditedAtUtc"),
  };
}

function normalizeProvenance(
  raw: unknown,
): Record<string, PartyFieldProvenanceEntry> {
  if (typeof raw !== "object" || raw === null) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([key, entry]) => [
      key,
      normalizeProvenanceEntry(entry),
    ]),
  );
}

function normalizeSubmissionDto(raw: unknown): PartyTaskSubmissionDto {
  const row = raw as Record<string, unknown>;
  return {
    id: (row.id ?? row.Id ?? undefined) as string | undefined,
    taskId: String(row.taskId ?? row.TaskId ?? ""),
    kind: String(row.kind ?? row.Kind ?? ""),
    status: String(row.status ?? row.Status ?? "draft"),
    propertyId: (row.propertyId ?? row.PropertyId ?? undefined) as string | undefined,
    poNumber: (row.poNumber ?? row.PoNumber ?? undefined) as string | undefined,
    payload: (row.payload ?? row.Payload ?? {}) as Record<string, unknown>,
    returnNote: (row.returnNote ?? row.ReturnNote ?? undefined) as string | undefined,
    submittedAtUtc: (row.submittedAtUtc ?? row.SubmittedAtUtc ?? undefined) as
      | string
      | undefined,
    acceptedAtUtc: (row.acceptedAtUtc ?? row.AcceptedAtUtc ?? undefined) as
      | string
      | undefined,
    submittedByUserId: (row.submittedByUserId ?? row.SubmittedByUserId ?? undefined) as
      | string
      | undefined,
    submittedByName: (row.submittedByName ?? row.SubmittedByName ?? undefined) as
      | string
      | undefined,
    acceptedByUserId: (row.acceptedByUserId ?? row.AcceptedByUserId ?? undefined) as
      | string
      | undefined,
    acceptedByName: (row.acceptedByName ?? row.AcceptedByName ?? undefined) as
      | string
      | undefined,
    reopenedByUserId: (row.reopenedByUserId ?? row.ReopenedByUserId ?? undefined) as
      | string
      | undefined,
    reopenedByName: (row.reopenedByName ?? row.ReopenedByName ?? undefined) as
      | string
      | undefined,
    updatedAtUtc: String(row.updatedAtUtc ?? row.UpdatedAtUtc ?? ""),
    fieldInspectionCompleted: (() => {
      const raw = row.fieldInspectionCompleted ?? row.FieldInspectionCompleted;
      if (raw === true || raw === false) return raw;
      return undefined;
    })(),
    fieldInspectionAccepted: (() => {
      const raw = row.fieldInspectionAccepted ?? row.FieldInspectionAccepted;
      if (raw === true || raw === false) return raw;
      return undefined;
    })(),
    studyReportIssued: (() => {
      const raw = row.studyReportIssued ?? row.StudyReportIssued;
      if (raw === true || raw === false) return raw;
      return undefined;
    })(),
    fieldProvenance: normalizeProvenance(
      row.fieldProvenance ?? row.FieldProvenance,
    ),
    sourceFingerprint:
      (row.sourceFingerprint ?? row.SourceFingerprint ?? undefined) as
        | string
        | undefined,
    inspectorDataFingerprint: (() => {
      const raw = row.inspectorDataFingerprint ?? row.InspectorDataFingerprint;
      return typeof raw === "string" && raw.trim() ? raw : undefined;
    })(),
    inspectorDataChangedGroups: (() => {
      const raw = row.inspectorDataChangedGroups ?? row.InspectorDataChangedGroups;
      if (!Array.isArray(raw)) return undefined;
      return raw.filter((g): g is string => typeof g === "string" && g.trim() !== "");
    })(),
  };
}

/** Unsaved GET placeholders have no row id — treat them as "not started". */
export function isPersistedPartyTaskSubmission(
  dto: PartyTaskSubmissionDto | null | undefined,
): dto is PartyTaskSubmissionDto {
  return Boolean(dto?.id?.trim());
}

export async function getPartyTaskSubmission(
  config: WorkOrdersApiConfig,
  taskId: string,
): Promise<ApiOk<PartyTaskSubmissionDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/party-task-submissions/${taskId}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: normalizeSubmissionDto(await res.json()) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function savePartyTaskSubmission(
  config: WorkOrdersApiConfig,
  taskId: string,
  payload: Record<string, unknown>,
): Promise<
  | ApiOk<PartyTaskSubmissionDto>
  | (ApiErr & { errors?: Record<string, string> })
> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/party-task-submissions/${taskId}`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify({ payload } satisfies SavePartyTaskSubmissionRequest),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403 || res.status === 400) return parseSaveFailure(res);
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: normalizeSubmissionDto(await res.json()) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function submitPartyTaskSubmission(
  config: WorkOrdersApiConfig,
  taskId: string,
  idempotencyKey?: string,
): Promise<
  | ApiOk<PartyTaskSubmissionDto>
  | (ApiErr & { errors?: Record<string, string> })
> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/party-task-submissions/${taskId}/submit`, {
      method: "POST",
      headers: headers(config.token, idempotencyKey),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403 || res.status === 400) return parseSaveFailure(res);
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: normalizeSubmissionDto(await res.json()) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function reopenPartyTaskSubmission(
  config: WorkOrdersApiConfig,
  taskId: string,
  returnNote: string,
): Promise<
  | ApiOk<PartyTaskSubmissionDto>
  | (ApiErr & { errors?: Record<string, string> })
> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/party-task-submissions/${taskId}/reopen`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify({ returnNote } satisfies ReopenPartyTaskSubmissionRequest),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403 || res.status === 400) return parseSaveFailure(res);
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: normalizeSubmissionDto(await res.json()) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** Specialist accepts party outputs (survey fee accrual; inspection → Enfaz package). */
export async function acceptPartyTaskSubmission(
  config: WorkOrdersApiConfig,
  taskId: string,
  idempotencyKey?: string,
): Promise<
  | ApiOk<PartyTaskSubmissionDto>
  | (ApiErr & { errors?: Record<string, string> })
> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/party-task-submissions/${taskId}/accept`, {
      method: "POST",
      headers: headers(config.token, idempotencyKey),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403 || res.status === 400) return parseSaveFailure(res);
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: normalizeSubmissionDto(await res.json()) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function listPartyTaskSubmissions(
  config: WorkOrdersApiConfig,
  workflowTaskIds: string[],
): Promise<ApiOk<PartyTaskSubmissionDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  const ids = workflowTaskIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return { ok: true, data: [] };

  const params = new URLSearchParams({
    workflowTaskIds: ids.join(","),
  });

  try {
    const res = await fetch(`${base}/api/party-task-submissions?${params}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as unknown[];
    return {
      ok: true,
      data: Array.isArray(raw) ? raw.map(normalizeSubmissionDto) : [],
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/* ─── Return the inspection with the affected parties (batch 2C, wire (d)) ─── */

/** Inspector-data groups the specialist may send back. */
export type ReturnImpactSection = { key: string; labelAr: string };

export type ReturnImpactPartyKind = "property-appraisal" | "engineering-survey";
export type ReturnImpactPackageStatus = "none" | "draft" | "submitted" | "reopened";

export type ReturnImpactParty = {
  taskId: string;
  kind: ReturnImpactPartyKind | string;
  assigneeName: string;
  packageStatus: ReturnImpactPackageStatus | string;
  /** The server's default for the chosen sections (pre-checked in the dialog). */
  suggested: boolean;
  suggestedBecause: string[];
  /** What happens to this party if it is picked: its package is reopened, or it is only notified. */
  willBe: "reopen" | "notify" | string;
};

export type ReturnImpactDto = {
  sections: ReturnImpactSection[];
  parties: ReturnImpactParty[];
  studyReportIssued: boolean;
  valuationClosed: boolean;
};

export type ReturnInspectionStudyReportDecision = "keep" | "reopen";

export type ReturnInspectionRequest = {
  returnNote: string;
  sections: string[];
  affectedTaskIds: string[];
  /** Required by the server when the study report is already issued. */
  studyReport: ReturnInspectionStudyReportDecision | null;
  studyReportReopenReason?: string;
};

export type ReturnInspectionPartyOutcomeKind =
  | "reopened"
  | "notified"
  | "already"
  | "skipped_deposited"
  | "skipped_no_assignee";

export type ReturnInspectionPartyOutcome = {
  taskId: string;
  kind: string;
  outcome: ReturnInspectionPartyOutcomeKind | string;
};

export type ReturnInspectionResultDto = {
  inspection: PartyTaskSubmissionDto;
  parties: ReturnInspectionPartyOutcome[];
  studyReport: { issued: boolean; reopened: boolean };
};

function textOf(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

function listOf(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : [];
}

function normalizeReturnImpact(raw: unknown): ReturnImpactDto {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    sections: listOf(row.sections ?? row.Sections).map((s) => {
      const r = (s ?? {}) as Record<string, unknown>;
      return {
        key: textOf(r.key ?? r.Key),
        labelAr: textOf(r.labelAr ?? r.LabelAr),
      };
    }),
    parties: listOf(row.parties ?? row.Parties).map((p) => {
      const r = (p ?? {}) as Record<string, unknown>;
      return {
        taskId: textOf(r.taskId ?? r.TaskId),
        kind: textOf(r.kind ?? r.Kind),
        assigneeName: textOf(r.assigneeName ?? r.AssigneeName),
        packageStatus: textOf(r.packageStatus ?? r.PackageStatus) || "none",
        suggested: (r.suggested ?? r.Suggested) === true,
        suggestedBecause: listOf(r.suggestedBecause ?? r.SuggestedBecause).filter(
          (x): x is string => typeof x === "string",
        ),
        willBe: textOf(r.willBe ?? r.WillBe) || "notify",
      };
    }),
    studyReportIssued: (row.studyReportIssued ?? row.StudyReportIssued) === true,
    valuationClosed: (row.valuationClosed ?? row.ValuationClosed) === true,
  };
}

function normalizeReturnInspectionResult(raw: unknown): ReturnInspectionResultDto {
  const row = (raw ?? {}) as Record<string, unknown>;
  const study = ((row.studyReport ?? row.StudyReport) ?? {}) as Record<string, unknown>;
  return {
    inspection: normalizeSubmissionDto(row.inspection ?? row.Inspection ?? {}),
    parties: listOf(row.parties ?? row.Parties).map((p) => {
      const r = (p ?? {}) as Record<string, unknown>;
      return {
        taskId: textOf(r.taskId ?? r.TaskId),
        kind: textOf(r.kind ?? r.Kind),
        outcome: textOf(r.outcome ?? r.Outcome),
      };
    }),
    studyReport: {
      issued: (study.issued ?? study.Issued) === true,
      reopened: (study.reopened ?? study.Reopened) === true,
    },
  };
}

/** Who a return of these inspector-data sections would hit (read-only; nothing changes). */
export async function getReturnImpact(
  config: WorkOrdersApiConfig,
  inspectionTaskId: string,
  sections: string[],
): Promise<ApiOk<ReturnImpactDto> | (ApiErr & { errors?: Record<string, string> })> {
  const base = config.baseUrl ?? getApiBase();
  const query = new URLSearchParams({ sections: sections.join(",") });
  try {
    const res = await fetch(
      `${base}/api/party-task-submissions/${inspectionTaskId}/return-impact?${query}`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (res.status === 403 || res.status === 400) return parseSaveFailure(res);
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: normalizeReturnImpact(await res.json()) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** Returns the inspection to the inspector and reopens / notifies the picked parties in one transaction. */
export async function returnInspectionPackage(
  config: WorkOrdersApiConfig,
  inspectionTaskId: string,
  request: ReturnInspectionRequest,
  idempotencyKey?: string,
): Promise<
  | ApiOk<ReturnInspectionResultDto>
  | (ApiErr & { errors?: Record<string, string> })
> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/party-task-submissions/${inspectionTaskId}/return-inspection`,
      {
        method: "POST",
        headers: headers(config.token, idempotencyKey),
        body: JSON.stringify(request),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403 || res.status === 400) return parseSaveFailure(res);
    if (res.status === 409) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "validation", errors };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: normalizeReturnInspectionResult(await res.json()) };
  } catch {
    return { ok: false, kind: "network" };
  }
}
