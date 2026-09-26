import { describe, expect, it } from "vitest";
import {
  formatPropertyDeedDisplay,
  propertyHasRegisteredTitle,
  propertyRequiresSurvey,
  propertySkipsBourse,
  skipsBourseForIdentifier,
} from "../po-intake-identifiers";

describe("formatPropertyDeedDisplay", () => {
  it("prefers the real-estate registry number over the deed number when both exist", () => {
    expect(
      formatPropertyDeedDisplay({
        identifierType: "deed",
        deedNumber: "940115012717",
        realEstateRegNumber: "2291227155600000",
      }),
    ).toBe("2291227155600000");
    expect(
      formatPropertyDeedDisplay({
        identifierType: "deed",
        deedNumber: "940115012717",
        realEstateRegNumber: "",
      }),
    ).toBe("940115012717");
    expect(
      formatPropertyDeedDisplay({
        identifierType: "real_estate_reg",
        deedNumber: "",
        realEstateRegNumber: "2291227155600000",
      }),
    ).toBe("2291227155600000");
  });
});

describe("registered title vs bourse", () => {
  it("does not skip bourse for real-estate registration", () => {
    expect(skipsBourseForIdentifier("real_estate_reg")).toBe(false);
    expect(
      propertySkipsBourse({
        identifierType: "real_estate_reg",
        realEstateRegNumber: "12345",
      }),
    ).toBe(false);
  });

  it("still treats a filled registry as registered title for survey", () => {
    const registered = {
      identifierType: "real_estate_reg" as const,
      realEstateRegNumber: "12345",
      classification: "أرض",
    };
    expect(propertyHasRegisteredTitle(registered)).toBe(true);
    expect(propertyRequiresSurvey(registered)).toBe(false);
    expect(
      propertyHasRegisteredTitle({
        identifierType: "deed",
        realEstateRegNumber: "",
      }),
    ).toBe(false);
    expect(
      propertyHasRegisteredTitle({
        identifierType: "deed",
        realEstateRegNumber: "",
        deedKind: "registered_title",
      }),
    ).toBe(true);
    expect(
      propertyRequiresSurvey({
        identifierType: "deed",
        realEstateRegNumber: "",
        classification: "أرض",
        deedKind: "registered_title",
      }),
    ).toBe(false);
  });
});
