import { refreshAuthSession } from "@platform/api-client";
import {
  getAuthSession,
  isRefreshTokenExpired,
  isSessionExpired,
  setAuthSession,
  shouldRefreshSession,
  type AuthSession,
} from "@platform/auth-client";

let inFlight: Promise<AuthSession | null> | null = null;

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
  const force = options.force ?? false;
  // Non-force callers share one in-flight renew (refresh tokens rotate).
  // Force (post-401) waits for that to finish, then renews with force.
  if (!force) {
    inFlight ??= renew(false).finally(() => {
      inFlight = null;
    });
    return inFlight;
  }
  return (inFlight ?? Promise.resolve(null)).then(() => renew(true));
}

async function renew(force: boolean): Promise<AuthSession | null> {
  const stored = getAuthSession();
  if (!stored) return null;
  if (!force && !shouldRefreshSession(stored)) {
    return isSessionExpired(stored) ? null : stored;
  }
  if (isRefreshTokenExpired(stored)) {
    return isSessionExpired(stored) ? null : stored;
  }

  const result = await refreshAuthSession(stored.refreshToken!);
  if (result.ok) {
    const session: AuthSession = {
      token: result.session.token,
      expiresAtUtc: result.session.expiresAtUtc,
      refreshToken: result.session.refreshToken,
      refreshTokenExpiresAtUtc: result.session.refreshTokenExpiresAtUtc,
      user: result.session.user,
    };
    setAuthSession(session);
    return session;
  }

  if (result.kind === "auth") return null;
  // Transient failure: keep the session while its access token is still valid.
  return isSessionExpired(stored) ? null : stored;
}
