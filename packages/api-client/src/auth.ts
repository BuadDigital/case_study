import type { UserListItem } from "@platform/types";
import { getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";

export type AuthApiConfig = {
  baseUrl?: string;
  token: string;
};

export type AuthSessionPayload = {
  token: string;
  expiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  user: { id: string; displayName: string; jobTitle?: string };
};

export type RefreshSessionResult =
  | { ok: true; session: AuthSessionPayload }
  | {
      ok: false;
      kind: "network" | "server" | "auth";
      /**
       * The server refused because an admin disabled the account (problem code
       * `account-disabled`) — the device must wipe its offline data (spec §3.4).
       */
      accountDisabled?: boolean;
    };

/** Problem `code` the identity service returns when a disabled account tries to refresh. */
export const ACCOUNT_DISABLED_CODE = "account-disabled";

export type FetchMyProfileResult =
  | { ok: true; user: UserListItem }
  | { ok: false; kind: "network" | "server" | "auth" };

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
      displayName: readString(user, "displayName"),
      ...(readString(user, "jobTitle")
        ? { jobTitle: readString(user, "jobTitle") }
        : {}),
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
      // Login/boot must not hang forever when the API is slow or unreachable.
      signal: AbortSignal.timeout(5_000),
    });
    if (res.status === 401) {
      const problem = (await res.json().catch(() => null)) as { code?: string } | null;
      return {
        ok: false,
        kind: "auth",
        accountDisabled: problem?.code === ACCOUNT_DISABLED_CODE,
      };
    }
    if (res.status === 400) return { ok: false, kind: "auth" };
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
      // Localhost / dead API must not trap the UI logout path.
      signal: AbortSignal.timeout(2500),
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
