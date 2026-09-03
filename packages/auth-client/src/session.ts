export const AUTH_STORAGE_KEY = "auth";
export const AUTH_COOKIE_NAME = "ree-auth";
const AUTH_EXPIRED_EVENT = "auth-expired";
/** Fired whenever the stored session is written, cleared, or changed in another tab. */
export const AUTH_CHANGED_EVENT = "auth-changed";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
  expiresAtUtc: string;
  /** Opaque rotating token exchanged for a new access token. */
  refreshToken?: string;
  refreshTokenExpiresAtUtc?: string;
};

/** Renew this long before the access token expires, so requests never race it. */
const SESSION_REFRESH_LEAD_MS = 4 * 60 * 1000;

/** Keep JSON.parse results referentially stable for useSyncExternalStore snapshots. */
let sessionCache: { raw: string | null; session: AuthSession | null } = {
  raw: null,
  session: null,
};

function rememberSession(raw: string | null, session: AuthSession | null): AuthSession | null {
  sessionCache = { raw, session };
  return session;
}

function emitAuthChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function isSessionExpired(
  session: AuthSession | null | undefined,
): boolean {
  if (!session?.expiresAtUtc) return true;
  const expires = Date.parse(session.expiresAtUtc);
  if (Number.isNaN(expires)) return true;
  return expires <= Date.now();
}

/** True when the access token is expired or close enough to expiry to renew. */
export function shouldRefreshSession(
  session: AuthSession | null | undefined,
  leadMs: number = SESSION_REFRESH_LEAD_MS,
): boolean {
  if (!session?.refreshToken) return false;
  const expires = Date.parse(session.expiresAtUtc);
  if (Number.isNaN(expires)) return true;
  return expires - Date.now() <= leadMs;
}

/** True once the refresh token itself is gone — nothing left to renew with. */
export function isRefreshTokenExpired(
  session: AuthSession | null | undefined,
): boolean {
  if (!session?.refreshToken) return true;
  if (!session.refreshTokenExpiresAtUtc) return false;
  const expires = Date.parse(session.refreshTokenExpiresAtUtc);
  if (Number.isNaN(expires)) return false;
  return expires <= Date.now();
}

function syncAuthCookie(session: AuthSession | null): void {
  if (typeof document === "undefined") return;
  if (
    !session ||
    (isSessionExpired(session) && isRefreshTokenExpired(session))
  ) {
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
    return;
  }
  // The cookie tracks how long the login can be renewed, not the short access token.
  const until = Date.parse(
    session.refreshTokenExpiresAtUtc ?? session.expiresAtUtc,
  );
  const maxAge = Math.max(60, Math.floor((until - Date.now()) / 1000));
  document.cookie = `${AUTH_COOKIE_NAME}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  // localStorage is the shared source so opening the application in another tab
  // keeps the same browser session. sessionStorage remains as a migration fallback.
  const shared = localStorage.getItem(AUTH_STORAGE_KEY);
  const raw = shared ?? sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (raw === sessionCache.raw) return sessionCache.session;
  if (!raw) return rememberSession(null, null);
  try {
    const session = JSON.parse(raw) as AuthSession;
    if (!shared) localStorage.setItem(AUTH_STORAGE_KEY, raw);
    return rememberSession(raw, session);
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    return rememberSession(null, null);
  }
}

export function getValidAuthSession(): AuthSession | null {
  const session = getAuthSession();
  if (!session || isSessionExpired(session)) return null;
  return session;
}

export function setAuthSession(session: AuthSession): void {
  const serialized = JSON.stringify(session);
  localStorage.setItem(AUTH_STORAGE_KEY, serialized);
  sessionStorage.setItem(AUTH_STORAGE_KEY, serialized);
  rememberSession(serialized, session);
  syncAuthCookie(session);
  emitAuthChanged();
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  rememberSession(null, null);
  syncAuthCookie(null);
  emitAuthChanged();
}

export function notifyAuthExpired(): void {
  clearAuthSession();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
}

export function subscribeAuthExpired(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AUTH_EXPIRED_EVENT, listener);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
}

/**
 * Subscribe to any auth storage change (same-tab writes + cross-tab storage).
 * Safe for useSyncExternalStore — getAuthSession() returns a stable reference
 * until the underlying storage value changes.
 */
export function subscribeAuthSession(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key !== AUTH_STORAGE_KEY && event.key !== null) return;
    // Drop the cache so the next snapshot re-reads (other tab changed storage).
    sessionCache = { raw: null, session: null };
    onStoreChange();
  };
  const onChanged = () => onStoreChange();

  window.addEventListener("storage", onStorage);
  window.addEventListener(AUTH_CHANGED_EVENT, onChanged);
  window.addEventListener(AUTH_EXPIRED_EVENT, onChanged);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(AUTH_CHANGED_EVENT, onChanged);
    window.removeEventListener(AUTH_EXPIRED_EVENT, onChanged);
  };
}

// Keep logout synchronized across open tabs. `storage` fires in the other tabs,
// not in the tab that performed the removal.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== AUTH_STORAGE_KEY || event.newValue !== null) return;
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    rememberSession(null, null);
    syncAuthCookie(null);
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    emitAuthChanged();
  });
}
