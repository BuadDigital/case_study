/**
 * Field inspection workspaces API — denormalized reporting rows from PostgreSQL.
 */
import { getApiBase } from "./index";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

export type FieldInspectionWorkspacesApiConfig = WorkOrdersApiConfig;

export type FieldInspectionWorkspaceListItemDto = {
  workflowTaskId: string;
  propertyId: string | null;
  poNumber: string | null;
  inspectionDate: string | null;
  inspectionTime: string | null;
  status: string;
  requiredPhotoSlots: number;
  completedPhotoSlots: number;
  pendingPhotoApprovals: number;
  observationCount: number;
  attachmentCount: number;
  submittedAtUtc: string | null;
  updatedAtUtc: string;
};

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function normalizeListItem(
  raw: Record<string, unknown>,
): FieldInspectionWorkspaceListItemDto {
  return {
    workflowTaskId: String(raw.workflowTaskId ?? raw.WorkflowTaskId ?? ""),
    propertyId: (raw.propertyId ?? raw.PropertyId ?? null) as string | null,
    poNumber: (raw.poNumber ?? raw.PoNumber ?? null) as string | null,
    inspectionDate: (raw.inspectionDate ?? raw.InspectionDate ?? null) as
      | string
      | null,
    inspectionTime: (raw.inspectionTime ?? raw.InspectionTime ?? null) as
      | string
      | null,
    status: String(raw.status ?? raw.Status ?? ""),
    requiredPhotoSlots: Number(
      raw.requiredPhotoSlots ?? raw.RequiredPhotoSlots ?? 0,
    ),
    completedPhotoSlots: Number(
      raw.completedPhotoSlots ?? raw.CompletedPhotoSlots ?? 0,
    ),
    pendingPhotoApprovals: Number(
      raw.pendingPhotoApprovals ?? raw.PendingPhotoApprovals ?? 0,
    ),
    observationCount: Number(raw.observationCount ?? raw.ObservationCount ?? 0),
    attachmentCount: Number(raw.attachmentCount ?? raw.AttachmentCount ?? 0),
    submittedAtUtc: (raw.submittedAtUtc ?? raw.SubmittedAtUtc ?? null) as
      | string
      | null,
    updatedAtUtc: String(raw.updatedAtUtc ?? raw.UpdatedAtUtc ?? ""),
  };
}

export async function listFieldInspectionWorkspaces(
  config: FieldInspectionWorkspacesApiConfig,
  query?: { poNumber?: string; status?: string },
): Promise<ApiOk<FieldInspectionWorkspaceListItemDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  const params = new URLSearchParams();
  if (query?.poNumber?.trim()) params.set("poNumber", query.poNumber.trim());
  if (query?.status?.trim()) params.set("status", query.status.trim());
  const qs = params.toString();
  try {
    const res = await fetch(
      `${base}/api/field-inspection-workspaces${qs ? `?${qs}` : ""}`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>[];
    return { ok: true, data: raw.map(normalizeListItem) };
  } catch {
    return { ok: false, kind: "network" };
  }
}
