import { getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import type { ComparablePropertyDto } from "./comparable-properties";

export type PropertyComparableLinkItemDto = {
  linkId: string;
  propertyId: string;
  comparablePropertyId: string;
  description?: string | null;
  linkedByUserId?: string | null;
  linkedAtUtc: string;
  comparable: ComparablePropertyDto;
};

export type PropertyComparableLinkListDto = {
  propertyId: string;
  linkedCount: number;
  meetsMinimumForAppraisalPrep: boolean;
  minimumRequired: number;
  items: PropertyComparableLinkItemDto[];
};

type ApiConfig = { baseUrl?: string; token: string };

type Result<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      kind: "auth" | "network" | "server" | "validation";
      message?: string;
      errors?: Record<string, string>;
    };

function headers(token: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function listPropertyComparableLinks(
  config: ApiConfig,
  propertyId: string,
): Promise<Result<PropertyComparableLinkListDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/property-comparable-links?propertyId=${encodeURIComponent(propertyId)}`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as PropertyComparableLinkListDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function linkPropertyComparable(
  config: ApiConfig,
  body: {
    propertyId: string;
    comparablePropertyId: string;
    description?: string | null;
  },
): Promise<Result<PropertyComparableLinkListDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/property-comparable-links`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const payload = (await res.json().catch(() => null)) as {
        errors?: Record<string, string>;
        error?: string;
      } | null;
      return {
        ok: false,
        kind: "validation",
        message:
          payload?.errors
            ? Object.values(payload.errors)[0]
            : payload?.error ?? "تعذّر الربط",
        errors: payload?.errors,
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as PropertyComparableLinkListDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function patchPropertyComparableLinkDescription(
  config: ApiConfig,
  propertyId: string,
  comparablePropertyId: string,
  description: string | null,
): Promise<Result<PropertyComparableLinkItemDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/property-comparable-links/${encodeURIComponent(propertyId)}/${encodeURIComponent(comparablePropertyId)}`,
      {
        method: "PATCH",
        headers: headers(config.token),
        body: JSON.stringify({ description }),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as PropertyComparableLinkItemDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function unlinkPropertyComparable(
  config: ApiConfig,
  propertyId: string,
  comparablePropertyId: string,
): Promise<Result<null>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/property-comparable-links/${encodeURIComponent(propertyId)}/${encodeURIComponent(comparablePropertyId)}`,
      { method: "DELETE", headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: null };
  } catch {
    return { ok: false, kind: "network" };
  }
}
