import { getApiBase } from "./index";

export class ApiAuthError extends Error {
  constructor() {
    super("auth");
    this.name = "ApiAuthError";
  }
}

export type PermissionsApiConfig = {
  baseUrl?: string;
  token: string;
};

export type PermissionsDto = {
  userId: string;
  identityRoles: string[];
  prototypeRole?: string | null;
  displayName?: string | null;
  distributionAssigneeId?: string | null;
  pages: string[];
  capabilities: string[];
};

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchPermissions(config: PermissionsApiConfig): Promise<PermissionsDto> {
  const base = config.baseUrl ?? getApiBase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${base}/api/permissions`, {
      headers: headers(config.token),
      signal: controller.signal,
    });
    if (res.status === 401) throw new ApiAuthError();
    if (!res.ok) throw new Error(`permissions ${res.status}`);
    return res.json() as Promise<PermissionsDto>;
  } finally {
    clearTimeout(timer);
  }
}
