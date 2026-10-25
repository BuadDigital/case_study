import { authHeaders, getApiBase } from "./api-base";
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

/** The answer of both GET and PUT: 401 → auth, 403 → forbidden, other failures → server. */
async function readListsResult(res: Response): Promise<Result<ValuationListsDto>> {
  if (res.status === 401) return { ok: false, kind: "auth" };
  if (res.status === 403) return { ok: false, kind: "forbidden" };
  if (!res.ok) return { ok: false, kind: "server" };
  return { ok: true, data: normalize(await parseJson<ValuationListsDto>(res)) };
}

export async function getValuationLists(
  config: ValuationListsApiConfig,
): Promise<Result<ValuationListsDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/valuation-lists`, {
      headers: authHeaders(config.token, { accept: true }),
    });
    return await readListsResult(res);
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
      headers: authHeaders(config.token, { accept: true }),
      body: JSON.stringify(body),
    });
    return await readListsResult(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}
