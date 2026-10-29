import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  refreshAuthSession: vi.fn(),
  revokeAuthSession: vi.fn(),
}));
vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  ...api,
}));

import { isCrossTabUserSwitch } from "@platform/auth-client";
import { ensureFreshAuthSession } from "../ensure-fresh-session";

const HOUR = 3_600_000;

function session(userId: string, refreshToken: string, expiresInMs: number) {
  return {
    token: `t-${userId}`,
    user: { id: userId, displayName: userId },
    expiresAtUtc: new Date(Date.now() + expiresInMs).toISOString(),
    refreshToken,
    refreshTokenExpiresAtUtc: new Date(Date.now() + 8 * HOUR).toISOString(),
  };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  api.refreshAuthSession.mockReset();
  api.revokeAuthSession.mockReset();
});

describe("a refresh that returns after another tab signed in", () => {
  it("keeps the newer user's session and revokes the late token", async () => {
    // The specialist's session is due for renewal…
    localStorage.setItem("auth", JSON.stringify(session("specialist", "r-old", -HOUR)));
    // …and while the refresh is in flight another tab signs in as the appraiser.
    const appraiser = session("appraiser", "r-appraiser", HOUR);
    api.refreshAuthSession.mockImplementation(async () => {
      localStorage.setItem("auth", JSON.stringify(appraiser));
      return { ok: true, session: session("specialist", "r-new", HOUR) };
    });

    const result = await ensureFreshAuthSession();

    expect(result?.user.id).toBe("appraiser");
    expect(JSON.parse(localStorage.getItem("auth")!).user.id).toBe("appraiser");
    expect(api.revokeAuthSession).toHaveBeenCalledWith("r-new");
  });

  it("still stores the renewed session when nothing changed meanwhile", async () => {
    localStorage.setItem("auth", JSON.stringify(session("specialist", "r-old", -HOUR)));
    api.refreshAuthSession.mockResolvedValue({
      ok: true,
      session: session("specialist", "r-new", HOUR),
    });

    const result = await ensureFreshAuthSession();

    expect(result?.refreshToken).toBe("r-new");
    expect(JSON.parse(localStorage.getItem("auth")!).refreshToken).toBe("r-new");
    expect(api.revokeAuthSession).not.toHaveBeenCalled();
  });
});

describe("isCrossTabUserSwitch", () => {
  const raw = (id: string) => JSON.stringify(session(id, "r", HOUR));

  it("is true only when both sessions exist and belong to different people", () => {
    expect(isCrossTabUserSwitch(raw("a"), raw("b"))).toBe(true);
    // a renewal of the same user, a sign-in on an empty tab, a sign-out: no switch
    expect(isCrossTabUserSwitch(raw("a"), raw("a"))).toBe(false);
    expect(isCrossTabUserSwitch(null, raw("a"))).toBe(false);
    expect(isCrossTabUserSwitch(raw("a"), null)).toBe(false);
    expect(isCrossTabUserSwitch("not json", raw("a"))).toBe(false);
  });
});
