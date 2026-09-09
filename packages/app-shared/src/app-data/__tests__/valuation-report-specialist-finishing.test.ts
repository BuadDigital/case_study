import { describe, expect, it } from "vitest";
import { specialistFinishingLevelForInspection } from "../valuation-report-specialist-finishing";

describe("specialistFinishingLevelForInspection", () => {
  it("drops a stale building finishing value for submitted land", () => {
    expect(
      specialistFinishingLevelForInspection("luxury", {
        status: "submitted",
        assetSubject: "أرض",
        initialAssetSubject: "فيلا",
      }),
    ).toBe("");
  });

  it("uses the initial type before submission and keeps building finishing", () => {
    expect(
      specialistFinishingLevelForInspection("medium", {
        status: "draft",
        assetSubject: "أرض",
        initialAssetSubject: "فيلا",
      }),
    ).toBe("medium");
  });
});
