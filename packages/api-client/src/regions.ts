import { getApiBase } from "./index";
import { repositoryFetch as fetch } from "./write-repository";

export type RegionsApiConfig = {
  baseUrl?: string;
  token: string;
};

export type SelectableRegionDto = {
  id: string;
  officialId?: number;
  code: string;
  nameAr: string;
  capitalAr: string;
};

export type SelectableCityDto = {
  id: string;
  officialId?: number | null;
  regionId: string;
  nameAr: string;
  nameEn?: string | null;
  isCapital: boolean;
  isGovernorate?: boolean;
  status?: string;
  regionNameAr?: string;
};

export type SelectableDistrictDto = {
  id: string;
  cityId: string;
  nameAr: string;
  status: string;
};

export type LocationSimilarityDto = {
  id: string;
  nameAr: string;
  status: string;
  isApproved: boolean;
};

export type SuggestLocationRequest = {
  kind: "city" | "district";
  regionId?: string;
  cityId?: string;
  nameAr: string;
  forceCreate?: boolean;
};

export type SuggestLocationResultDto = {
  created: boolean;
  requiresConfirmation: boolean;
  city?: SelectableCityDto | null;
  district?: SelectableDistrictDto | null;
  similar: LocationSimilarityDto[];
};

export type PendingLocationDto = {
  id: string;
  kind: "city" | "district" | string;
  nameAr: string;
  rawInput?: string | null;
  scopeLabel: string;
  usageCount: number;
  createdByUserId?: string | null;
  createdAtUtc: string;
};

export type ReviewLocationRequest = {
  action: "approve" | "rename" | "merge";
  nameAr?: string;
  mergeIntoId?: string;
};

function headers(token: string, json = false): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
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
  query?: string,
): Promise<SelectableCitiesResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const qs =
      query?.trim()
        ? `?q=${encodeURIComponent(query.trim())}`
        : "";
    const res = await fetch(
      `${base}/api/regions/${encodeURIComponent(regionId)}/cities/selectable${qs}`,
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

export type SelectableDistrictsResult =
  | { ok: true; districts: SelectableDistrictDto[] }
  | { ok: false; kind: "auth" | "network" | "server" };

export async function listSelectableDistricts(
  config: RegionsApiConfig,
  cityId: string,
  query?: string,
): Promise<SelectableDistrictsResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const qs =
      query?.trim()
        ? `?q=${encodeURIComponent(query.trim())}`
        : "";
    const res = await fetch(
      `${base}/api/regions/cities/${encodeURIComponent(cityId)}/districts${qs}`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const districts = (await res.json()) as SelectableDistrictDto[];
    return { ok: true, districts: Array.isArray(districts) ? districts : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export type SuggestLocationResult =
  | { ok: true; result: SuggestLocationResultDto }
  | { ok: false; kind: "auth" | "network" | "server"; message?: string };

export async function suggestLocation(
  config: RegionsApiConfig,
  body: SuggestLocationRequest,
): Promise<SuggestLocationResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/regions/suggest`, {
      method: "POST",
      headers: headers(config.token, true),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) {
      let message: string | undefined;
      try {
        const err = (await res.json()) as { message?: string };
        message = err.message;
      } catch {
        /* ignore */
      }
      return { ok: false, kind: "server", message };
    }
    const result = (await res.json()) as SuggestLocationResultDto;
    return {
      ok: true,
      result: {
        ...result,
        similar: Array.isArray(result.similar) ? result.similar : [],
      },
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export type PendingLocationsResult =
  | { ok: true; items: PendingLocationDto[] }
  | { ok: false; kind: "auth" | "forbidden" | "network" | "server" };

export async function listPendingLocations(
  config: RegionsApiConfig,
): Promise<PendingLocationsResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/regions/pending`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return { ok: false, kind: "server" };
    const items = (await res.json()) as PendingLocationDto[];
    return { ok: true, items: Array.isArray(items) ? items : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export type ReviewLocationResult =
  | { ok: true }
  | { ok: false; kind: "auth" | "forbidden" | "network" | "server"; message?: string };

export async function reviewPendingCity(
  config: RegionsApiConfig,
  id: string,
  body: ReviewLocationRequest,
): Promise<ReviewLocationResult> {
  return reviewPending(config, "cities", id, body);
}

export async function reviewPendingDistrict(
  config: RegionsApiConfig,
  id: string,
  body: ReviewLocationRequest,
): Promise<ReviewLocationResult> {
  return reviewPending(config, "districts", id, body);
}

async function reviewPending(
  config: RegionsApiConfig,
  kind: "cities" | "districts",
  id: string,
  body: ReviewLocationRequest,
): Promise<ReviewLocationResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/regions/${kind}/${encodeURIComponent(id)}/review`,
      {
        method: "POST",
        headers: headers(config.token, true),
        body: JSON.stringify(body),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) {
      let message: string | undefined;
      try {
        const err = (await res.json()) as { message?: string };
        message = err.message;
      } catch {
        /* ignore */
      }
      return { ok: false, kind: "server", message };
    }
    return { ok: true };
  } catch {
    return { ok: false, kind: "network" };
  }
}
