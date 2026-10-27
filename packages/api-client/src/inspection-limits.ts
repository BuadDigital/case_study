import { parseFieldErrorsFromResponse } from "./field-errors";
import { authHeaders, getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

/** Inspection scope: full · external only · desktop remote. */
export type InspectionScopeKey = "full" | "external" | "desktop";

export type UninspectedUnitEntryDto = {
  count: number;
  reason: string;
};

/** Inspection limits — structured inputs filled by the inspector. */
export type InspectionLimitsDto = {
  propertyId: string;
  /** full | external | desktop | "" (not captured yet). */
  inspectionScopeKey: InspectionScopeKey | "" | string;
  inspectionScopeLabelAr: string;
  inspectionRestrictionReason?: string | null;
  uninspectedUnits: UninspectedUnitEntryDto[];
  totalUninspectedUnits: number;
  /** Auto-composed caveat text — feeds special assumptions. */
  reservationTextAr: string;
  /** Certified valuer approval for desktop-remote scope. */
  remoteInspectionApprovedBy?: string | null;
  remoteInspectionApprovedAtUtc?: string | null;
  remoteInspectionApproved: boolean;
};

export type SaveInspectionLimitsRequest = {
  inspectionScopeKey: InspectionScopeKey | string;
  inspectionRestrictionReason?: string | null;
  uninspectedUnits: UninspectedUnitEntryDto[];
};

function url(base: string, poNumber: string, propertyId: string): string {
  return `${base}/api/work-orders/${encodeURIComponent(poNumber)}/properties/${propertyId}/inspection-limits`;
}

export async function getInspectionLimits(
  config: WorkOrdersApiConfig,
  poNumber: string,
  propertyId: string,
): Promise<ApiOk<InspectionLimitsDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(url(base, poNumber, propertyId), {
      headers: authHeaders(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as InspectionLimitsDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function saveInspectionLimits(
  config: WorkOrdersApiConfig,
  poNumber: string,
  propertyId: string,
  body: SaveInspectionLimitsRequest,
): Promise<ApiOk<InspectionLimitsDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(url(base, poNumber, propertyId), {
      method: "PUT",
      headers: authHeaders(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "server", errors };
    }
    return { ok: true, data: (await res.json()) as InspectionLimitsDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}
