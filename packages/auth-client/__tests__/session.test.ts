import { describe, expect, it } from "vitest";
import {
  getValidAuthSession,
  isSessionExpired,
  type AuthSession,
} from "../src/session";

const baseSession: AuthSession = {
  token: "t",
  user: { id: "1", email: "a@b.c", displayName: "Test" },
  expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
};

describe("auth session", () => {
  it("detects expired sessions", () => {
    expect(isSessionExpired(baseSession)).toBe(false);
    expect(
      isSessionExpired({
        ...baseSession,
        expiresAtUtc: new Date(Date.now() - 1_000).toISOString(),
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
    sessionStorage.clear();
  });
});
