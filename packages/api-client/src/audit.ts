import { getApiBase } from "./api-base";
import { ApiAuthError } from "./permissions";

type AuditLogApiConfig = {
  baseUrl?: string;
  token: string;
};

export type AuditLogDto = {
  id: string;
  actorId: string;
  /** Resolved from identity when the actor is a known system user. */
  actorDisplayName?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  createdAtUtc: string;
};

type AuditLogPageDto = {
  items: AuditLogDto[];
  page: number;
  limit: number;
  total: number;
};

type AuditLogFilters = {
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

/**
 * «سجل تعديلات البيانات» of one property — the field change log of every save of property data
 * (ruling 2026-11-02). Each item's `before` maps field → old value; `after.fields` maps field → new
 * value, beside `actorName`, `actorRole`, `actorSubRoles` and `autosave`. Newest first.
 */
export async function listPropertyChangeLog(
  config: AuditLogApiConfig,
  propertyId: string,
  page = 1,
  limit = 50,
): Promise<AuditLogPageDto> {
  const base = config.baseUrl ?? getApiBase();
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  const response = await fetch(
    `${base}/api/audit-log/property-changes/${encodeURIComponent(propertyId)}?${query}`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
    },
  );
  if (response.status === 401) throw new ApiAuthError();
  if (response.status === 403) throw new Error("property-change-log forbidden");
  if (!response.ok) throw new Error(`property-change-log ${response.status}`);
  return response.json() as Promise<AuditLogPageDto>;
}
