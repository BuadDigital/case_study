import { getApiBase } from "./index";

export type CourtsApiConfig = {
  baseUrl?: string;
  token: string;
};

export type CourtCatalogEntryDto = {
  id: string;
  city: string;
  court: string;
  circuits: string[];
};

export type SelectableCourtDto = {
  id: string;
  name: string;
  region: string;
  city: string;
};

export type SelectableCircuitDto = {
  id: string;
  courtId: string;
  circuitNo: string;
  circuitName?: string | null;
};

export type AdminCourtDto = SelectableCourtDto & {
  isActive: boolean;
  circuitsCount: number;
  createdBy: string;
  createdAtUtc: string;
  updatedBy?: string | null;
  updatedAtUtc?: string | null;
};

export type AdminCourtCircuitDto = SelectableCircuitDto & {
  isActive: boolean;
  createdBy: string;
  createdAtUtc: string;
  updatedBy?: string | null;
  updatedAtUtc?: string | null;
};

export type AdminCourtDetailDto = AdminCourtDto & {
  circuits: AdminCourtCircuitDto[];
};

export type AdminCourtsPageDto = {
  data: AdminCourtDto[];
  total: number;
  page: number;
  limit: number;
};

export type CourtDraftDto = {
  name: string;
  region: string;
  city: string;
  isActive: boolean;
};

export type CourtCircuitDraftDto = {
  circuitNo: string;
  circuitName?: string | null;
  isActive: boolean;
};

export type CourtsAdminResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      kind: "auth" | "forbidden" | "validation" | "not_found" | "network" | "server";
      message?: string;
    };

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function adminRequest<T>(
  config: CourtsApiConfig,
  path: string,
  init?: RequestInit,
): Promise<CourtsAdminResult<T>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { ...headers(config.token), ...init?.headers },
    });
    if (res.ok) return { ok: true, data: (await res.json()) as T };

    let message: string | undefined;
    try {
      const body = (await res.json()) as { message?: string };
      message = body.message;
    } catch {
      // The status code is enough when the response has no JSON body.
    }
    if (res.status === 401) return { ok: false, kind: "auth", message };
    if (res.status === 403) return { ok: false, kind: "forbidden", message };
    if (res.status === 404) return { ok: false, kind: "not_found", message };
    if (res.status === 400 || res.status === 422) {
      return { ok: false, kind: "validation", message };
    }
    return { ok: false, kind: "server", message };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export function listAdminCourts(
  config: CourtsApiConfig,
  query?: {
    search?: string;
    status?: "all" | "active" | "inactive";
    region?: string;
    city?: string;
    page?: number;
    limit?: number;
  },
): Promise<CourtsAdminResult<AdminCourtsPageDto>> {
  const qs = new URLSearchParams();
  if (query?.search) qs.set("search", query.search);
  if (query?.status) qs.set("status", query.status);
  if (query?.region) qs.set("region", query.region);
  if (query?.city) qs.set("city", query.city);
  if (query?.page) qs.set("page", String(query.page));
  if (query?.limit) qs.set("limit", String(query.limit));
  const suffix = qs.size ? `?${qs}` : "";
  return adminRequest(config, `/api/admin/courts${suffix}`);
}

export function getAdminCourt(
  config: CourtsApiConfig,
  id: string,
): Promise<CourtsAdminResult<AdminCourtDetailDto>> {
  return adminRequest(config, `/api/admin/courts/${encodeURIComponent(id)}`);
}

export function createAdminCourt(
  config: CourtsApiConfig,
  draft: CourtDraftDto,
): Promise<CourtsAdminResult<AdminCourtDto>> {
  return adminRequest(config, "/api/admin/courts", {
    method: "POST",
    body: JSON.stringify(draft),
  });
}

export function updateAdminCourt(
  config: CourtsApiConfig,
  id: string,
  draft: Partial<CourtDraftDto>,
): Promise<CourtsAdminResult<AdminCourtDto>> {
  return adminRequest(config, `/api/admin/courts/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(draft),
  });
}

export function setAdminCourtStatus(
  config: CourtsApiConfig,
  id: string,
  isActive: boolean,
): Promise<CourtsAdminResult<{ id: string; isActive: boolean }>> {
  return adminRequest(
    config,
    `/api/admin/courts/${encodeURIComponent(id)}/status`,
    { method: "PATCH", body: JSON.stringify({ isActive }) },
  );
}

export function createAdminCourtCircuit(
  config: CourtsApiConfig,
  courtId: string,
  draft: CourtCircuitDraftDto,
): Promise<CourtsAdminResult<AdminCourtCircuitDto>> {
  return adminRequest(
    config,
    `/api/admin/courts/${encodeURIComponent(courtId)}/circuits`,
    { method: "POST", body: JSON.stringify(draft) },
  );
}

export function updateAdminCourtCircuit(
  config: CourtsApiConfig,
  courtId: string,
  circuitId: string,
  draft: Partial<CourtCircuitDraftDto>,
): Promise<CourtsAdminResult<AdminCourtCircuitDto>> {
  return adminRequest(
    config,
    `/api/admin/courts/${encodeURIComponent(courtId)}/circuits/${encodeURIComponent(circuitId)}`,
    { method: "PUT", body: JSON.stringify(draft) },
  );
}

export function setAdminCourtCircuitStatus(
  config: CourtsApiConfig,
  courtId: string,
  circuitId: string,
  isActive: boolean,
): Promise<CourtsAdminResult<{ id: string; isActive: boolean }>> {
  return adminRequest(
    config,
    `/api/admin/courts/${encodeURIComponent(courtId)}/circuits/${encodeURIComponent(circuitId)}/status`,
    { method: "PATCH", body: JSON.stringify({ isActive }) },
  );
}

export type CourtsListResult =
  | { ok: true; entries: CourtCatalogEntryDto[] }
  | { ok: false; kind: "auth" | "network" | "server" };

export async function listCourts(
  config: CourtsApiConfig,
): Promise<CourtsListResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/courts`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const entries = (await res.json()) as CourtCatalogEntryDto[];
    return { ok: true, entries: Array.isArray(entries) ? entries : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function replaceCourtsCatalog(
  config: CourtsApiConfig,
  entries: CourtCatalogEntryDto[],
): Promise<CourtsListResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/courts`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify({ entries }),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const list = (await res.json()) as CourtCatalogEntryDto[];
    return { ok: true, entries: Array.isArray(list) ? list : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export type SelectableCourtsResult =
  | { ok: true; courts: SelectableCourtDto[] }
  | { ok: false; kind: "auth" | "network" | "server" };

export async function listSelectableCourts(
  config: CourtsApiConfig,
  query?: { region?: string; city?: string },
): Promise<SelectableCourtsResult> {
  const base = config.baseUrl ?? getApiBase();
  const qs = new URLSearchParams();
  if (query?.region) qs.set("region", query.region);
  if (query?.city) qs.set("city", query.city);
  const suffix = qs.size > 0 ? `?${qs}` : "";
  try {
    const res = await fetch(`${base}/api/courts/selectable${suffix}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const courts = (await res.json()) as SelectableCourtDto[];
    return { ok: true, courts: Array.isArray(courts) ? courts : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export type SelectableCircuitsResult =
  | { ok: true; circuits: SelectableCircuitDto[] }
  | { ok: false; kind: "auth" | "network" | "server" };

export async function listSelectableCircuits(
  config: CourtsApiConfig,
  courtId: string,
): Promise<SelectableCircuitsResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/courts/${encodeURIComponent(courtId)}/circuits/selectable`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const circuits = (await res.json()) as SelectableCircuitDto[];
    return { ok: true, circuits: Array.isArray(circuits) ? circuits : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}
