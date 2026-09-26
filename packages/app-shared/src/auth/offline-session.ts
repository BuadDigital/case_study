import {
  getAuthSession,
  getValidAuthSession,
  isRefreshTokenExpired,
  type AuthSession,
} from "@platform/auth-client";
import { readOfflineAccess } from "../offline/offline-access-cache";

/**
 * A field user whose access token lapsed while the device is offline. The token
 * cannot be renewed without a network, but the login is still good (refresh token in
 * date) and their role is known from the last online visit — so the app keeps them
 * signed in. AuthSessionWatcher caps this with the 3-hour offline lease.
 */
export function isOfflineUsableSession(
  session: AuthSession | null | undefined,
): session is AuthSession {
  if (!session || isRefreshTokenExpired(session)) return false;
  if (typeof navigator === "undefined" || navigator.onLine !== false) return false;
  return readOfflineAccess(session.user.id) !== null;
}

/** The in-date session, or the stored one while it is offline-usable. */
export function getUsableAuthSession(): AuthSession | null {
  const valid = getValidAuthSession();
  if (valid) return valid;
  const stored = getAuthSession();
  return isOfflineUsableSession(stored) ? stored : null;
}
