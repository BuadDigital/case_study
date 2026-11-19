import { authHeaders, getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import { ApiErrorKinds } from "./api-error-kinds";

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

export type CaseStudyInfoRolesResult =
  | { ok: true; config: CaseStudyInfoRolesConfigDto }
  | { ok: false; kind: "auth" | "network" | "server" };

/** The answer of both GET and PUT: 401 → auth, other failures → server, else the saved config. */
async function readInfoRolesResult(res: Response): Promise<CaseStudyInfoRolesResult> {
  if (res.status === 401) return { ok: false, kind: ApiErrorKinds.Auth };
  if (!res.ok) return { ok: false, kind: ApiErrorKinds.Server };
  const data = (await res.json()) as CaseStudyInfoRolesConfigDto;
  return { ok: true, config: data };
}

export async function getCaseStudyInfoRoles(
  config: CaseStudyInfoRolesApiConfig,
): Promise<CaseStudyInfoRolesResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/case-study-info-roles`, {
      headers: authHeaders(config.token),
    });
    return await readInfoRolesResult(res);
  } catch {
    return { ok: false, kind: ApiErrorKinds.Network };
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
      headers: authHeaders(config.token),
      body: JSON.stringify(request),
    });
    return await readInfoRolesResult(res);
  } catch {
    return { ok: false, kind: ApiErrorKinds.Network };
  }
}
