import { parseFieldErrorsFromResponse } from "./field-errors";
import { getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import type { PartyFieldProvenanceEntry } from "./party-task-submissions";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

export type BuildingStructureKind =
  | "floor"
  | "fence"
  | "annex"
  | "basement"
  | "other";

export type BuildingInventoryLineDto = {
  id?: string;
  sortOrder: number;
  structureKind: BuildingStructureKind | string;
  label: string;
  areaSqm?: string | null;
  notes?: string | null;
  /** Direct-cost catalog key (`@platform/app-shared/domain/cost-items`); null on legacy rows. */
  itemKey?: string | null;
  /** sqm | lm | count | lump */
  unit?: string | null;
  buildRatioPct?: number | null;
  repeatedFloorCount?: number | null;
  /** Read-only: who wrote / last edited this line (server-stamped). Ignored on save. */
  provenance?: PartyFieldProvenanceEntry | null;
};

export type BuildingInventoryDto = {
  propertyId: string;
  hasStructuresToValue: "" | "yes" | "no" | string;
  /** «مكونات العقار» written by the case specialist — printed as the report's «وصف العقار». */
  componentsText?: string;
  lines: BuildingInventoryLineDto[];
};

/**
 * Full replace: lines missing from the request are deleted, lines carrying an `id` are
 * updated in place, lines without one are created. Writers: the case study staff, and the
 * field inspector assigned to this property (before he submits; a reopened inspection is
 * open again). After he submitted the server answers with the field error `_`.
 */
export type SaveBuildingInventoryRequest = {
  /** Ignored by the server — derived from whether any line is listed. */
  hasStructuresToValue?: "" | "yes" | "no" | string;
  /**
   * Omit to keep the saved text. The text is the case specialist's: the server ignores it
   * when the inspector writes, so the inspector's screen never shows or edits it.
   */
  componentsText?: string;
  lines: BuildingInventoryLineDto[];
};

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function url(base: string, poNumber: string, propertyId: string): string {
  return `${base}/api/work-orders/${encodeURIComponent(poNumber)}/properties/${propertyId}/building-inventory`;
}

/**
 * GET the table. Readable by the case study staff and by the assigned field inspector; the
 * field inspector's session keeps a copy on the device (`building-inventory-offline`).
 */
export async function getBuildingInventory(
  config: WorkOrdersApiConfig,
  poNumber: string,
  propertyId: string,
): Promise<ApiOk<BuildingInventoryDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(url(base, poNumber, propertyId), {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as BuildingInventoryDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/**
 * PUT the table (see `SaveBuildingInventoryRequest`). A 4xx the server will never accept
 * on retry (400/409/422 — e.g. «المعاينة أُرسلت…» under `errors._`) is `validation`; 403 is
 * `forbidden`; a 5xx is `server` — so the offline replay can drop the first two and retry
 * the last.
 */
export async function saveBuildingInventory(
  config: WorkOrdersApiConfig,
  poNumber: string,
  propertyId: string,
  body: SaveBuildingInventoryRequest,
): Promise<ApiOk<BuildingInventoryDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(url(base, poNumber, propertyId), {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) {
      return { ok: false, kind: "forbidden", errors: await parseFieldErrorsFromResponse(res) };
    }
    if (!res.ok) {
      const errors = await parseFieldErrorsFromResponse(res);
      const rejected = res.status === 400 || res.status === 409 || res.status === 422;
      return { ok: false, kind: rejected ? "validation" : "server", errors };
    }
    return { ok: true, data: (await res.json()) as BuildingInventoryDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}
