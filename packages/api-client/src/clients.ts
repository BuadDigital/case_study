import { parseFieldErrorsFromResponse } from "./field-errors";
import { getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

export type ClientDto = {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  identityNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type UpsertClientRequest = {
  nameAr: string;
  nameEn?: string | null;
  identityNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive?: boolean;
};

/** Seeded Infath assignment-center client id (matches backend SeedClientIds). */
export const INFATH_SEED_CLIENT_ID = "a1000001-0000-4000-8000-000000000001";

/** Seeded Nabr Real Estate client — private-sector valuation report user. */
export const NABR_SEED_CLIENT_ID = "a1000001-0000-4000-8000-000000000002";

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function listClients(
  config: WorkOrdersApiConfig,
  includeInactive = false,
): Promise<ApiOk<ClientDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const qs = includeInactive ? "?includeInactive=true" : "";
    const res = await fetch(`${base}/api/clients${qs}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as ClientDto[] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function getClient(
  config: WorkOrdersApiConfig,
  id: string,
): Promise<ApiOk<ClientDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/clients/${encodeURIComponent(id)}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as ClientDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function createClient(
  config: WorkOrdersApiConfig,
  body: UpsertClientRequest,
): Promise<ApiOk<ClientDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/clients`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "server", errors };
    }
    return { ok: true, data: (await res.json()) as ClientDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function updateClient(
  config: WorkOrdersApiConfig,
  id: string,
  body: UpsertClientRequest,
): Promise<ApiOk<ClientDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/clients/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "server", errors };
    }
    return { ok: true, data: (await res.json()) as ClientDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function deactivateClient(
  config: WorkOrdersApiConfig,
  id: string,
): Promise<ApiOk<true> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/clients/${encodeURIComponent(id)}/deactivate`,
      {
        method: "POST",
        headers: headers(config.token),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      return {
        ok: false,
        kind: "server",
        message: payload?.message ?? "تعذّر تعطيل العميل",
      };
    }
    return { ok: true, data: true };
  } catch {
    return { ok: false, kind: "network" };
  }
}
