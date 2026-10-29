import { refreshAuthSession, revokeAuthSession } from "@platform/api-client";
import {
  clearAuthSession,
  ensureAuthGateCookie,
  getAuthSession,
  isRefreshTokenExpired,
  isSessionExpired,
  setAuthSession,
  shouldRefreshSession,
  type AuthSession,
} from "@platform/auth-client";

let inFlight: Promise<FreshAuthSessionResult> | null = null;

type FreshAuthSessionResult =
  | { status: "ok"; session: AuthSession }
  | { status: "none" }
  | { status: "auth" }
  | { status: "transient"; session: AuthSession };

/**
 * Typed session renewal: auth failures are distinct from timeouts / 5xx, so the
 * app gate can keep a field user whose refresh token is still valid.
 */
export function resolveFreshAuthSession(
  options: { force?: boolean } = {},
): Promise<FreshAuthSessionResult> {
  const force = options.force ?? false;
  if (!force) {
    inFlight ??= renew(false).finally(() => {
      inFlight = null;
    });
    return inFlight;
  }
  return (inFlight ?? Promise.resolve({ status: "none" as const })).then(() =>
    renew(true),
  );
}

/**
 * Returns a session whose access token is safely in date, renewing it through the
 * refresh endpoint when it is close to expiry. Returns null when the session can no
 * longer be used, which callers treat as "send the user to login".
 *
 * Concurrent callers share one request: rotating the same refresh token twice would
 * otherwise look like a replay to the server. Pass `force` after a 401 to renew even
 * though the stored expiry still looks fine.
 */
export function ensureFreshAuthSession(
  options: { force?: boolean } = {},
): Promise<AuthSession | null> {
  return resolveFreshAuthSession(options).then((result) => {
    if (result.status === "ok") return result.session;
    if (result.status === "transient" && !isSessionExpired(result.session)) {
      ensureAuthGateCookie();
      return result.session;
    }
    return null;
  });
}

/**
 * Renews the stored session when it is due (or forced).
 *
 * How it works: reads the shared session; returns it as is when it is still in date;
 * otherwise exchanges its refresh token and stores the result.
 *
 * Edge cases: a refresh that comes back after the stored session was replaced (another
 * tab signed in as someone else, or already rotated the token) is dropped and its new
 * token revoked — the newer session stays. Fixed 2026-10-28: the late write used to
 * restore the previous user in every tab.
 */
async function renew(force: boolean): Promise<FreshAuthSessionResult> {
  const stored = getAuthSession();
  if (!stored) return { status: "none" };
  if (!force && !shouldRefreshSession(stored)) {
    if (isSessionExpired(stored)) return { status: "none" };
    ensureAuthGateCookie();
    return { status: "ok", session: stored };
  }
  if (isRefreshTokenExpired(stored)) {
    if (isSessionExpired(stored)) return { status: "none" };
    ensureAuthGateCookie();
    return { status: "ok", session: stored };
  }

  const result = await refreshAuthSession(stored.refreshToken!);
  // Another tab may have signed in (or renewed) while this refresh was in flight: the
  // shared storage then holds a newer session, and writing ours would put the old user
  // back into every tab (seen 2026-10-28 — an appraiser tab ran as the specialist).
  const current = getAuthSession();
  if (result.ok && current?.refreshToken !== stored.refreshToken) {
    void revokeAuthSession(result.session.refreshToken);
    if (current && !isSessionExpired(current)) return { status: "ok", session: current };
    return { status: "none" };
  }
  if (result.ok) {
    const session: AuthSession = {
      token: result.session.token,
      expiresAtUtc: result.session.expiresAtUtc,
      refreshToken: result.session.refreshToken,
      refreshTokenExpiresAtUtc: result.session.refreshTokenExpiresAtUtc,
      user: result.session.user,
    };
    setAuthSession(session);
    try {
      const { clearOfflineLease } = await import("@platform/offline-client");
      await clearOfflineLease(session.user.id);
    } catch {
      /* IndexedDB unavailable — the session is still usable. */
    }
    return { status: "ok", session };
  }

  if (result.kind === "auth") {
    if (result.accountDisabled) await wipeDisabledAccountDevice(stored.user.id);
    return { status: "auth" };
  }
  return { status: "transient", session: stored };
}

/**
 * Spec: a disabled user is refused and the device wipes its local store on the first
 * connection — drafts, queued work, photos, downloaded documents, the session itself.
 * Only for a disabled account: an expired session keeps unsynced work for the next login.
 */
async function wipeDisabledAccountDevice(userId: string): Promise<void> {
  try {
    const { closeOfflineDb, purgeOfflineData } = await import("@platform/offline-client");
    await purgeOfflineData(userId, "account-disabled");
    await closeOfflineDb();
  } catch {
    /* IndexedDB unavailable — the session is still cleared below. */
  }
  clearAuthSession();
}
