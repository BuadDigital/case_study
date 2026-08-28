import { getApiBase } from "./index";
import { repositoryFetch as fetch } from "./write-repository";
import { parseJson } from "./parse-json";

export type ValuationListItemDto = {
  id: string;
  key: string;
  name: string;
  cells: string[];
  isEnabled: boolean;
  defaultName: string;
  usage: number;
  sortOrder: number;
  isSystemDefault: boolean;
  isRequired: boolean;
  propertyTypeKeys: string[];
};

export type ValuationListsDto = {
  ivsEffectiveDate: string;
  photoPagesLand: number;
  photoPagesBuilt: number;
  lists: Record<string, ValuationListItemDto[]>;
  updatedAtUtc: string;
};

export type ValuationListsApiConfig = {
  baseUrl?: string;
  token: string;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "auth" | "network" | "server" | "forbidden"; message?: string };

function headers(token: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}


function normalize(data: ValuationListsDto): ValuationListsDto {
  return {
    ivsEffectiveDate: data.ivsEffectiveDate ?? "",
    photoPagesLand: data.photoPagesLand ?? 1,
    photoPagesBuilt: data.photoPagesBuilt ?? 2,
    lists: data.lists ?? {},
    updatedAtUtc: data.updatedAtUtc ?? "",
  };
}

export function activeValuationListOptions(
  lists: Record<string, ValuationListItemDto[]> | undefined,
  listId: string,
): { value: string; label: string }[] {
  return (lists?.[listId] ?? [])
    .filter((row) => row.isEnabled)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => ({ value: row.key, label: row.name }));
}

export async function getValuationLists(
  config: ValuationListsApiConfig,
): Promise<Result<ValuationListsDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/valuation-lists`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: normalize(await parseJson<ValuationListsDto>(res)) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function saveValuationLists(
  config: ValuationListsApiConfig,
  body: {
    ivsEffectiveDate?: string;
    photoPagesLand?: number;
    photoPagesBuilt?: number;
    lists?: Record<string, ValuationListItemDto[]>;
  },
): Promise<Result<ValuationListsDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/valuation-lists`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: normalize(await parseJson<ValuationListsDto>(res)) };
  } catch {
    return { ok: false, kind: "network" };
  }
}
