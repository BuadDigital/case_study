import { describe, expect, it } from "vitest";
import {
  propertyHasRegisteredTitle,
  propertyRequiresSurvey,
  propertySkipsBourse,
  skipsBourseForIdentifier,
} from "../po-intake-identifiers";

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
  });
});
