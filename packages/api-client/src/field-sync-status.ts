import { getApiBase } from "./index";
import { repositoryFetch as fetch } from "./write-repository";
import { ApiAuthError } from "./permissions";

export type FieldSyncApiConfig = {
  baseUrl?: string;
  token: string;
};

export type UpsertFieldSyncStatusRequest = {
  pendingCount: number;
  oldestPendingAtUtc?: string | null;
  kinds: string[];
  displayName?: string | null;
  roleId?: string | null;
};

export type FieldSyncStatusDto = {
  id: string;
  userId: string;
  displayName?: string | null;
  roleId?: string | null;
  pendingCount: number;
  oldestPendingAtUtc?: string | null;
  lastSeenAtUtc: string;
  kinds: string[];
  ageHours?: number | null;
  stale: boolean;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "network" | "server" | "auth" | "forbidden" };

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function upsertFieldSyncStatus(
  config: FieldSyncApiConfig,
  body: UpsertFieldSyncStatusRequest,
): Promise<Result<null>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/field-sync-status`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: null };
  } catch (err) {
    if (err instanceof ApiAuthError) return { ok: false, kind: "auth" };
    return { ok: false, kind: "network" };
  }
}

export async function clearFieldSyncStatus(
  config: FieldSyncApiConfig,
): Promise<Result<null>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/field-sync-status`, {
      method: "DELETE",
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: null };
  } catch (err) {
    if (err instanceof ApiAuthError) return { ok: false, kind: "auth" };
    return { ok: false, kind: "network" };
  }
}

export async function listStaleFieldSyncStatuses(
  config: FieldSyncApiConfig,
): Promise<Result<FieldSyncStatusDto[]>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/field-sync-status/stale`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Array<Record<string, unknown>>;
    const data = raw.map((row) => ({
      id: String(row.id ?? row.Id ?? ""),
      userId: String(row.userId ?? row.UserId ?? ""),
      displayName: (row.displayName ?? row.DisplayName ?? null) as string | null,
      roleId: (row.roleId ?? row.RoleId ?? null) as string | null,
      pendingCount: Number(row.pendingCount ?? row.PendingCount ?? 0),
      oldestPendingAtUtc: (row.oldestPendingAtUtc ??
        row.OldestPendingAtUtc ??
        null) as string | null,
      lastSeenAtUtc: String(row.lastSeenAtUtc ?? row.LastSeenAtUtc ?? ""),
      kinds: Array.isArray(row.kinds ?? row.Kinds)
        ? ((row.kinds ?? row.Kinds) as unknown[]).map(String)
        : [],
      ageHours: (row.ageHours ?? row.AgeHours ?? null) as number | null,
      stale: Boolean(row.stale ?? row.Stale ?? false),
    }));
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ApiAuthError) return { ok: false, kind: "auth" };
    return { ok: false, kind: "network" };
  }
}
