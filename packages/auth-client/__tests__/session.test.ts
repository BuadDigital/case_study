import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_CHANGED_EVENT,
  AUTH_STORAGE_KEY,
  clearAuthSession,
  getAuthSession,
  getValidAuthSession,
  isRefreshTokenExpired,
  isSessionExpired,
  setAuthSession,
  shouldRefreshSession,
  subscribeAuthSession,
  type AuthSession,
} from "../src/session";

const baseSession: AuthSession = {
  token: "t",
  user: { id: "1", email: "a@b.c", displayName: "Test" },
  expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
};

describe("auth session", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
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
