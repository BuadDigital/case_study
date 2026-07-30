import type { UserListItem } from "@platform/types";
import { getApiBase } from "./index";
import { repositoryFetch as fetch } from "./write-repository";

export type DevLoginUserDto = {
  username: string;
  label: string;
};

export type AuthApiConfig = {
  baseUrl?: string;
  token: string;
};

export type AuthSessionPayload = {
  token: string;
  expiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  user: { id: string; email: string; displayName: string };
};

export type RefreshSessionResult =
  | { ok: true; session: AuthSessionPayload }
  | { ok: false; kind: "network" | "server" | "auth" };

export type FetchMyProfileResult =
  | { ok: true; user: UserListItem }
  | { ok: false; kind: "network" | "server" | "auth" };

export type DevLoginUsersResult =
  | { ok: true; users: DevLoginUserDto[] }
  | { ok: false; kind: "network" | "server" | "unavailable" };

export async function fetchDevLoginUsers(
  baseUrl?: string,
): Promise<DevLoginUsersResult> {
  const base = baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/auth/dev-login-users`);
    if (res.status === 404) return { ok: false, kind: "unavailable" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as unknown[];
    const users = Array.isArray(raw)
      ? raw.map((row) => {
          const item = row as Record<string, unknown>;
          return {
            username: String(item.username ?? item.Username ?? ""),
            label: String(item.label ?? item.Label ?? ""),
          };
        })
      : [];
    return { ok: true, users: users.filter((u) => u.username) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

function readString(row: Record<string, unknown>, key: string): string {
  const pascal = key.charAt(0).toUpperCase() + key.slice(1);
  return String(row[key] ?? row[pascal] ?? "");
}

export function normalizeAuthSessionPayload(
  raw: Record<string, unknown>,
): AuthSessionPayload {
  const user = (raw.user ?? raw.User ?? {}) as Record<string, unknown>;
  return {
    token: readString(raw, "token"),
    expiresAtUtc: readString(raw, "expiresAtUtc"),
    refreshToken: readString(raw, "refreshToken"),
    refreshTokenExpiresAtUtc: readString(raw, "refreshTokenExpiresAtUtc"),
    user: {
      id: readString(user, "id"),
      email: readString(user, "email"),
      displayName: readString(user, "displayName"),
    },
  };
}

/** Exchanges a refresh token for a new access token plus its replacement. */
export async function refreshAuthSession(
  refreshToken: string,
  baseUrl?: string,
): Promise<RefreshSessionResult> {
  const base = baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (res.status === 401 || res.status === 400) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const session = normalizeAuthSessionPayload(
      (await res.json()) as Record<string, unknown>,
    );
    if (!session.token) return { ok: false, kind: "server" };
    return { ok: true, session };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** Best-effort server-side logout; never throws. */
export async function revokeAuthSession(
  refreshToken: string,
  baseUrl?: string,
): Promise<void> {
  const base = baseUrl ?? getApiBase();
  try {
    await fetch(`${base}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      keepalive: true,
    });
  } catch {
    // Logout is local-first; a failed revoke only leaves the token to expire.
  }
}

export async function fetchMyProfile(
  config: AuthApiConfig,
): Promise<FetchMyProfileResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/auth/profile`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const user = (await res.json()) as UserListItem;
    return { ok: true, user };
  } catch {
    return { ok: false, kind: "network" };
  }
}
