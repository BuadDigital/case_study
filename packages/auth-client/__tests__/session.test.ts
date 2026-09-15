import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_CHANGED_EVENT,
  AUTH_COOKIE_NAME,
  AUTH_STORAGE_KEY,
  clearAuthSession,
  ensureAuthGateCookie,
  getAuthSession,
  getValidAuthSession,
  isAuthSessionUsable,
  isRefreshTokenExpired,
  isSessionExpired,
  setAuthSession,
  shouldRefreshSession,
  subscribeAuthSession,
  type AuthSession,
} from "../src/session";

const baseSession: AuthSession = {
  token: "t",
  user: { id: "1", displayName: "Test" },
  expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
};

function cookieValue(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

describe("auth session", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0`;
    clearAuthSession();
  });

  it("detects expired sessions", () => {
    expect(isSessionExpired(baseSession)).toBe(false);
    expect(
      isSessionExpired({
        ...baseSession,
        expiresAtUtc: new Date(Date.now() - 1_000).toISOString(),
      }),
    ).toBe(true);
  });

  it("renews only when a refresh token is stored and expiry is near", () => {
    expect(shouldRefreshSession(baseSession)).toBe(false);

    const renewable: AuthSession = {
      ...baseSession,
      refreshToken: "r",
      refreshTokenExpiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
    };
    expect(shouldRefreshSession(renewable)).toBe(true);
    expect(
      shouldRefreshSession({
        ...renewable,
        expiresAtUtc: new Date(Date.now() + 600_000).toISOString(),
      }),
    ).toBe(false);
    expect(isRefreshTokenExpired(renewable)).toBe(false);
  });

  it("treats a session without a refresh token as unrenewable", () => {
    expect(isRefreshTokenExpired(baseSession)).toBe(true);
    expect(
      isRefreshTokenExpired({
        ...baseSession,
        refreshToken: "r",
        refreshTokenExpiresAtUtc: new Date(Date.now() - 1_000).toISOString(),
      }),
    ).toBe(true);
  });

  it("treats access-expired sessions with a live refresh token as usable", () => {
    expect(
      isAuthSessionUsable({
        ...baseSession,
        expiresAtUtc: new Date(Date.now() - 1_000).toISOString(),
        refreshToken: "r",
        refreshTokenExpiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
      }),
    ).toBe(true);
    expect(
      isAuthSessionUsable({
        ...baseSession,
        expiresAtUtc: new Date(Date.now() - 1_000).toISOString(),
      }),
    ).toBe(false);
  });

  it("returns null for expired stored session", () => {
    sessionStorage.setItem(
      "auth",
      JSON.stringify({
        ...baseSession,
        expiresAtUtc: new Date(Date.now() - 1_000).toISOString(),
      }),
    );
    expect(getValidAuthSession()).toBeNull();
  });

  it("shares the session through local storage for a newly opened tab", () => {
    setAuthSession(baseSession);
    sessionStorage.clear(); // A new tab starts without the source tab's session storage.

    expect(getAuthSession()).toEqual(baseSession);
    expect(sessionStorage.getItem("auth")).toBeNull();

    clearAuthSession();
    expect(localStorage.getItem("auth")).toBeNull();
  });

  it("heals the gate cookie from localStorage when the cookie was cleared", () => {
    setAuthSession({
      ...baseSession,
      refreshToken: "r",
      refreshTokenExpiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
    });
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0`;
    expect(cookieValue(AUTH_COOKIE_NAME)).toBeNull();

    ensureAuthGateCookie();
    expect(cookieValue(AUTH_COOKIE_NAME)).toBe("1");
  });

  it("returns a stable snapshot until storage changes", () => {
    setAuthSession(baseSession);
    const first = getAuthSession();
    const second = getAuthSession();
    expect(first).toBe(second);

    setAuthSession({ ...baseSession, token: "t2" });
    const third = getAuthSession();
    expect(third).not.toBe(first);
    expect(third?.token).toBe("t2");
  });

  it("notifies subscribers when the same-tab session changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAuthSession(listener);

    setAuthSession(baseSession);
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    clearAuthSession();
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    listener.mockClear();
    setAuthSession(baseSession);
    expect(listener).not.toHaveBeenCalled();
  });

  it("exposes a boot-safe path for hard navigation into a deep link", () => {
    // Simulates: tab A logged in (localStorage), tab B hard-loads a URL with empty
    // sessionStorage — the gate must still see the shared session.
    setAuthSession(baseSession);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);

    expect(getValidAuthSession()).toEqual(baseSession);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeTruthy();
  });

  it("emits auth-changed for same-tab writes", () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_CHANGED_EVENT, listener);
    setAuthSession(baseSession);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_CHANGED_EVENT, listener);
  });
});
