import { getApiBase } from "./index";

export type RegionsApiConfig = {
  baseUrl?: string;
  token: string;
};

export type SelectableRegionDto = {
  id: string;
  code: string;
  nameAr: string;
  capitalAr: string;
};

export type SelectableCityDto = {
  id: string;
  regionId: string;
  nameAr: string;
  isCapital: boolean;
  regionNameAr?: string;
};

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

export type SelectableRegionsResult =
  | { ok: true; regions: SelectableRegionDto[] }
  | { ok: false; kind: "auth" | "network" | "server" };

export async function listSelectableRegions(
  config: RegionsApiConfig,
): Promise<SelectableRegionsResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/regions/selectable`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const regions = (await res.json()) as SelectableRegionDto[];
    return { ok: true, regions: Array.isArray(regions) ? regions : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export type SelectableCitiesResult =
  | { ok: true; cities: SelectableCityDto[] }
  | { ok: false; kind: "auth" | "network" | "server" };

/** كل المدن النشطة (مع regionId) — لاختيار المدينة أولاً. */
export async function listAllSelectableCities(
  config: RegionsApiConfig,
): Promise<SelectableCitiesResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/regions/cities/selectable`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const cities = (await res.json()) as SelectableCityDto[];
    return { ok: true, cities: Array.isArray(cities) ? cities : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function listSelectableCities(
  config: RegionsApiConfig,
  regionId: string,
): Promise<SelectableCitiesResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/regions/${encodeURIComponent(regionId)}/cities/selectable`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const cities = (await res.json()) as SelectableCityDto[];
    return { ok: true, cities: Array.isArray(cities) ? cities : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}
