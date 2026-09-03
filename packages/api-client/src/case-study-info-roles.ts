import { getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";

export type CaseStudyInfoRolesApiConfig = {
  baseUrl?: string;
  token: string;
};

export type CaseStudyInfoRolesConfigDto = {
  matrix: Record<string, Record<string, string>>;
  notes: Record<string, string>;
  updatedAt: string;
};

export type SaveCaseStudyInfoRolesRequest = {
  matrix: Record<string, Record<string, string | null | undefined>>;
  notes: Record<string, string>;
};

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export type CaseStudyInfoRolesResult =
  | { ok: true; config: CaseStudyInfoRolesConfigDto }
  | { ok: false; kind: "auth" | "network" | "server" };

export async function getCaseStudyInfoRoles(
  config: CaseStudyInfoRolesApiConfig,
): Promise<CaseStudyInfoRolesResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/case-study-info-roles`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = (await res.json()) as CaseStudyInfoRolesConfigDto;
    return { ok: true, config: data };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function saveCaseStudyInfoRoles(
  config: CaseStudyInfoRolesApiConfig,
  request: SaveCaseStudyInfoRolesRequest,
): Promise<CaseStudyInfoRolesResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/case-study-info-roles`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify(request),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = (await res.json()) as CaseStudyInfoRolesConfigDto;
    return { ok: true, config: data };
  } catch {
    return { ok: false, kind: "network" };
  }
}
