import { describe, expect, it } from "vitest";
import { shouldApplyUpdate } from "../sw-update-policy";

describe("silent app update", () => {
  it("applies at load, on navigation and when the tab is hidden", () => {
    expect(shouldApplyUpdate({ moment: "load", pendingOfflineItems: 0 })).toBe(true);
    expect(shouldApplyUpdate({ moment: "navigation", pendingOfflineItems: 0 })).toBe(true);
    expect(shouldApplyUpdate({ moment: "hidden", pendingOfflineItems: 0 })).toBe(true);
  });

  it("never while offline work is still waiting to be sent", () => {
    expect(shouldApplyUpdate({ moment: "load", pendingOfflineItems: 1 })).toBe(false);
    expect(shouldApplyUpdate({ moment: "navigation", pendingOfflineItems: 3 })).toBe(false);
    expect(shouldApplyUpdate({ moment: "hidden", pendingOfflineItems: 2 })).toBe(false);
  });
});
