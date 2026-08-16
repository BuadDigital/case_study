import { parseFieldErrorsFromResponse } from "./field-errors";
import { getApiBase } from "./index";
import { repositoryFetch as fetch } from "./write-repository";
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
};

export type BuildingInventoryDto = {
  propertyId: string;
  hasStructuresToValue: "" | "yes" | "no" | string;
  lines: BuildingInventoryLineDto[];
};

export type SaveBuildingInventoryRequest = {
  hasStructuresToValue: "" | "yes" | "no" | string;
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
    if (!res.ok) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "server", errors };
    }
    return { ok: true, data: (await res.json()) as BuildingInventoryDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}
