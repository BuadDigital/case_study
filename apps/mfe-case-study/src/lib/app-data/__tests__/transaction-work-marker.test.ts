import { describe, expect, it } from "vitest";
import { workMarkerLine, WORK_MARKER_FRESH_MINUTES } from "../transaction-work-marker";

describe("«يعمل عليها الآن» (ruling 2026-11-02 — information only)", () => {
  const now = Date.parse("2026-11-03T10:00:00Z");

  it("names another specialist who touched the transaction lately", () => {
    expect(
      workMarkerLine(
        { workingByUserId: "u2", workingByName: "أسامة", workingAtUtc: "2026-11-03T09:50:00Z" },
        "u1",
        now,
      ),
    ).toBe("يعمل عليها الآن: أسامة");
  });

  it("hides the viewer's own mark, a stale mark and an empty one", () => {
    const old = new Date(now - (WORK_MARKER_FRESH_MINUTES + 1) * 60_000).toISOString();
    expect(workMarkerLine({ workingByUserId: "u1", workingByName: "أنا", workingAtUtc: "2026-11-03T09:59:00Z" }, "u1", now)).toBeNull();
    expect(workMarkerLine({ workingByUserId: "u2", workingByName: "أسامة", workingAtUtc: old }, "u1", now)).toBeNull();
    expect(workMarkerLine({}, "u1", now)).toBeNull();
  });
});
