export const AUTH_STORAGE_KEY = "auth";
export const AUTH_COOKIE_NAME = "ree-auth";
export const AUTH_EXPIRED_EVENT = "auth-expired";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
  expiresAtUtc: string;
};

export function isSessionExpired(session: AuthSession | null | undefined): boolean {
  if (!session?.expiresAtUtc) return true;
  const expires = Date.parse(session.expiresAtUtc);
  if (Number.isNaN(expires)) return true;
  return expires <= Date.now();
}

function syncAuthCookie(session: AuthSession | null): void {
  if (typeof document === "undefined") return;
  if (!session || isSessionExpired(session)) {
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
    return;
  }
  const maxAge = Math.max(
    60,
    Math.floor((Date.parse(session.expiresAtUtc) - Date.now()) / 1000),
  );
  document.cookie = `${AUTH_COOKIE_NAME}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function getValidAuthSession(): AuthSession | null {
  const session = getAuthSession();
  if (!session || isSessionExpired(session)) return null;
  return session;
}

export function setAuthSession(session: AuthSession): void {
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  syncAuthCookie(session);
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  syncAuthCookie(null);
}

export function hasAuthSession(): boolean {
  return getValidAuthSession() !== null;
}

export function getAuthDisplayName(): string | null {
  return getValidAuthSession()?.user.displayName ?? null;
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
