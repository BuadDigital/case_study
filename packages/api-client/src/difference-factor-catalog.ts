import { getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";

/** Decision 19.2 — admin-managed factor definition (definition + what it excludes). */
export type DifferenceFactorDefinitionDto = {
  key: string;
  labelAr: string;
  definitionAr: string;
  excludesAr: string;
  sortOrder: number;
  isActive: boolean;
};

export type DifferenceFactorCatalogDto = {
  factors: DifferenceFactorDefinitionDto[];
  version: number;
  updatedAtUtc: string;
};

export type DifferenceFactorCatalogApiConfig = {
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

export async function getDifferenceFactorCatalog(
  config: DifferenceFactorCatalogApiConfig,
): Promise<Result<DifferenceFactorCatalogDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/difference-factor-catalog`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as DifferenceFactorCatalogDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function saveDifferenceFactorCatalog(
  config: DifferenceFactorCatalogApiConfig,
  body: { factors: DifferenceFactorDefinitionDto[] },
): Promise<Result<DifferenceFactorCatalogDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/difference-factor-catalog`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify(body),
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
    return { ok: true, data: (await res.json()) as DifferenceFactorCatalogDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}
