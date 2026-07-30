import { getApiBase } from "./index";
import { ApiAuthError } from "./permissions";

export type AuditLogApiConfig = {
  baseUrl?: string;
  token: string;
};

export type AuditLogDto = {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  createdAtUtc: string;
};

export type AuditLogPageDto = {
  items: AuditLogDto[];
  page: number;
  limit: number;
  total: number;
};

export type AuditLogFilters = {
  entityType?: string;
  entityId?: string;
  action?: string;
  actorId?: string;
  page?: number;
  limit?: number;
};

export async function listAuditLog(
  config: AuditLogApiConfig,
  filters: AuditLogFilters = {},
): Promise<AuditLogPageDto> {
  const base = config.baseUrl ?? getApiBase();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === "") continue;
    query.set(key, String(value));
  }

  const suffix = query.size > 0 ? `?${query}` : "";
  const response = await fetch(`${base}/api/audit-log${suffix}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
  });
  if (response.status === 401) throw new ApiAuthError();
  if (response.status === 403) throw new Error("audit-log forbidden");
  if (!response.ok) throw new Error(`audit-log ${response.status}`);
  return response.json() as Promise<AuditLogPageDto>;
}
