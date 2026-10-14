import { authHeaders, getApiBase } from "./api-base";
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

export async function listPropertyComparableLinks(
  config: ApiConfig,
  propertyId: string,
): Promise<Result<PropertyComparableLinkListDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/property-comparable-links?propertyId=${encodeURIComponent(propertyId)}`,
      { headers: authHeaders(config.token, { accept: true }) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as PropertyComparableLinkListDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}
