import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PermissionsDto } from "@platform/api-client";
import type { AuthSession } from "@platform/auth-client";
import {
  readOfflineAccess,
  rememberOfflineAccess,
} from "../../offline/offline-access-cache";
import { getUsableAuthSession, isOfflineUsableSession } from "../offline-session";

const HOUR = 60 * 60 * 1000;

function permissions(overrides: Partial<PermissionsDto> = {}): PermissionsDto {
  return {
    userId: "u-1",
    identityRoles: ["user"],
    prototypeRole: "field-inspector",
    displayName: "أحمد",
    jobTitle: "معاين",
    department: "الميدان",
    pages: ["active-inspection"],
    capabilities: ["inspection.submit"],
    ...overrides,
  };
}

function lapsedSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    token: "t",
    user: { id: "u-1", displayName: "أحمد" },
    expiresAtUtc: new Date(Date.now() - HOUR).toISOString(),
    refreshToken: "r",
    refreshTokenExpiresAtUtc: new Date(Date.now() + 8 * HOUR).toISOString(),
    ...overrides,
  };
}

function setOnline(online: boolean) {
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(online);
}

describe("offline access cache", () => {
  beforeEach(() => localStorage.clear());

  it("stores a field inspector's access without personal fields", () => {
    rememberOfflineAccess("u-1", permissions());

    const cached = readOfflineAccess("u-1");
    expect(cached?.prototypeRole).toBe("field-inspector");
    expect(cached?.pages).toEqual(["active-inspection"]);
    expect(cached).not.toHaveProperty("displayName");
    expect(cached).not.toHaveProperty("department");
  });

  it("never returns another user's access", () => {
    rememberOfflineAccess("u-1", permissions());
    expect(readOfflineAccess("u-2")).toBeNull();
  });

  it("stores nothing for office roles or admins, and clears an earlier entry", () => {
    rememberOfflineAccess("u-1", permissions());
    rememberOfflineAccess("u-1", permissions({ prototypeRole: "case-specialist" }));
    expect(readOfflineAccess("u-1")).toBeNull();

    rememberOfflineAccess("u-1", permissions({ identityRoles: ["cdo"] }));
    expect(readOfflineAccess("u-1")).toBeNull();
  });
});

describe("isOfflineUsableSession", () => {
  beforeEach(() => {
    localStorage.clear();
    rememberOfflineAccess("u-1", permissions());
  });
  afterEach(() => vi.restoreAllMocks());

  it("keeps a lapsed field session while offline", () => {
    setOnline(false);
    expect(isOfflineUsableSession(lapsedSession())).toBe(true);
  });

  it("does not while online — the token must be renewed", () => {
    setOnline(true);
    expect(isOfflineUsableSession(lapsedSession())).toBe(false);
  });

  it("does not once the refresh token has expired", () => {
    setOnline(false);
    expect(
      isOfflineUsableSession(
        lapsedSession({
          refreshTokenExpiresAtUtc: new Date(Date.now() - HOUR).toISOString(),
        }),
      ),
    ).toBe(false);
  });

  it("does not without cached field access for that user", () => {
    setOnline(false);
    expect(
      isOfflineUsableSession(lapsedSession({ user: { id: "u-2", displayName: "x" } })),
    ).toBe(false);
  });

  it("getUsableAuthSession returns the stored lapsed session only offline", () => {
    localStorage.setItem("auth", JSON.stringify(lapsedSession()));
    setOnline(false);
    expect(getUsableAuthSession()?.user.id).toBe("u-1");
    setOnline(true);
    expect(getUsableAuthSession()).toBeNull();
  });
});
