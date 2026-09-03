import { describe, expect, it } from "vitest";
import { validatePropertyBourseFields } from "../../domain/po-intake/property-bourse-validation";
import { propertyHasIncompleteContact } from "../../domain/po-intake/property-validation";
import { emptyProperty } from "../po-intake-data";

describe("PO intake frontend/backend rule parity", () => {
  it("rejects an invalid restriction type even when restrictions are not present", () => {
    const property = {
      ...emptyProperty(),
      city: "الرياض",
      district: "العليا",
      bourseDeedImageFileName: "deed.png",
      restrictionsPresent: "no",
      restrictionType: "invalid",
    };

    expect(validatePropertyBourseFields(property).restrictionType).toBe(
      "قيمة نوع القيد غير صالحة",
    );
  });

  it("matches the backend whole-field incomplete-contact marker check", () => {
    const markerOnly = {
      ...emptyProperty(),
      contacts: [{ name: "", role: "مالك", phone: "0500000000" }],
    };
    const markerWithAnotherPhone = {
      ...emptyProperty(),
      contacts: [
        { name: "", role: "مالك", phone: "0500000000 0555555555" },
      ],
    };

    expect(propertyHasIncompleteContact(markerOnly)).toBe(true);
    expect(propertyHasIncompleteContact(markerWithAnotherPhone)).toBe(false);
  });
});
