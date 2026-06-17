import { getApiBase } from "./index";

export type PermissionsApiConfig = {
  baseUrl?: string;
  token: string;
};

export type PermissionsDto = {
  userId: string;
  identityRoles: string[];
  prototypeRole?: string | null;
  pages: string[];
  capabilities: string[];
};

export type MeDto = {
  id: string;
  email: string;
  displayName: string;
  permissions?: PermissionsDto | null;
};

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchPermissions(config: PermissionsApiConfig): Promise<PermissionsDto> {
  const base = config.baseUrl ?? getApiBase();
  const res = await fetch(`${base}/api/permissions`, {
    headers: headers(config.token),
  });
  if (!res.ok) throw new Error(`permissions ${res.status}`);
  return res.json() as Promise<PermissionsDto>;
}

export async function fetchMe(
  config: PermissionsApiConfig,
  includePermissions = true,
): Promise<MeDto> {
  const base = config.baseUrl ?? getApiBase();
  const q = includePermissions ? "?includePermissions=true" : "?includePermissions=false";
  const res = await fetch(`${base}/api/auth/me${q}`, {
    headers: headers(config.token),
  });
  if (!res.ok) throw new Error(`me ${res.status}`);
  return res.json() as Promise<MeDto>;
}
