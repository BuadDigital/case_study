import { getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";

/** Decision 20 — grouped-property linking (العقار المجمع). */
export type PropertyGroupMemberDto = {
  propertyId: string;
  poNumber: string;
  deedNumber: string;
  deedKind?: string | null;
  linkedByUserId: string;
  linkedAtUtc: string;
  signalLabelsAr: string[];
};

export type PropertyGroupDto = {
  id: string;
  name?: string | null;
  createdAtUtc: string;
  members: PropertyGroupMemberDto[];
};

export type PropertyGroupSuggestionDto = {
  propertyId: string;
  poNumber: string;
  deedNumber: string;
  ownerName?: string | null;
  planNumber?: string | null;
  plotNumber?: string | null;
  signalCodes: string[];
  signalLabelsAr: string[];
  existingGroupId?: string | null;
};

export type PropertyGroupsApiConfig = {
  baseUrl?: string;
  token: string;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "auth" | "network" | "server"; message?: string };

function headers(token: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function request<T>(
  config: PropertyGroupsApiConfig,
  path: string,
  init?: RequestInit,
): Promise<Result<T>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) {
      let message: string | undefined;
      try {
        message = ((await res.json()) as { error?: string }).error;
      } catch {
        message = undefined;
      }
      return { ok: false, kind: "server", message };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export function getPropertyGroup(
  config: PropertyGroupsApiConfig,
  propertyId: string,
): Promise<Result<PropertyGroupDto | null>> {
  return request(config, `/api/property-groups/by-property/${propertyId}`);
}

export function suggestPropertyGroupLinks(
  config: PropertyGroupsApiConfig,
  propertyId: string,
): Promise<Result<PropertyGroupSuggestionDto[]>> {
  return request(config, `/api/property-groups/by-property/${propertyId}/suggestions`);
}

export function confirmPropertyGroupLink(
  config: PropertyGroupsApiConfig,
  propertyId: string,
  targetPropertyId: string,
): Promise<Result<PropertyGroupDto>> {
  return request(config, `/api/property-groups/by-property/${propertyId}/link`, {
    method: "POST",
    body: JSON.stringify({ targetPropertyId }),
  });
}

export function unlinkPropertyGroup(
  config: PropertyGroupsApiConfig,
  propertyId: string,
  reason: string,
): Promise<Result<PropertyGroupDto>> {
  return request(config, `/api/property-groups/by-property/${propertyId}/unlink`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
