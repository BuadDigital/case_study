import { describe, expect, it } from "vitest";
import {
  SPECIALIST_FINISHING_REQUIRED_MESSAGE,
  specialistFinishingLevelForInspection,
  specialistFinishingLevelMissingMessage,
} from "../valuation-report-specialist-finishing";

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

describe("specialistFinishingLevelMissingMessage", () => {
  it("requires finishing for building packages", () => {
    expect(
      specialistFinishingLevelMissingMessage({
        propertyId: "p-missing",
        status: "submitted",
        assetSubject: "فيلا",
        initialAssetSubject: "فيلا",
      }),
    ).toBe(SPECIALIST_FINISHING_REQUIRED_MESSAGE);
  });

  it("skips finishing for submitted land", () => {
    expect(
      specialistFinishingLevelMissingMessage({
        propertyId: "p-land",
        status: "submitted",
        assetSubject: "أرض",
        initialAssetSubject: "فيلا",
      }),
    ).toBeNull();
  });
});
