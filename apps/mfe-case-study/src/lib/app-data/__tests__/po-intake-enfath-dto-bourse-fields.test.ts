import { describe, expect, it } from "vitest";
import { propertyToEnfathDto } from "../po-intake-model";
import { DEED_STATUS_ACTIVE, emptyProperty } from "../po-intake-data";

/**
 * Before the bourse is completed, saving the primary data sends `propertyToEnfathDto`, and the
 * server's ApplyPropertyEnfath writes Area and DeedStatus from it. Leaving them out of the payload
 * silently wiped an area / deed status already typed in the bourse step.
 */
describe("primary-data payload keeps the bourse area and deed status", () => {
  it("sends the area and deed status typed in the bourse step", () => {
    const dto = propertyToEnfathDto({
      ...emptyProperty(),
      deedNumber: "611508007272",
      area: " 1,250 ",
      deedStatus: DEED_STATUS_ACTIVE,
    });

    expect(dto.area).toBe("1,250");
    expect(dto.deedStatus).toBe(DEED_STATUS_ACTIVE);
  });

  it("sends nothing when they are empty", () => {
    const dto = propertyToEnfathDto({ ...emptyProperty(), deedNumber: "611508007272" });

    expect(dto.area).toBeUndefined();
    expect(dto.deedStatus).toBeUndefined();
  });
});
