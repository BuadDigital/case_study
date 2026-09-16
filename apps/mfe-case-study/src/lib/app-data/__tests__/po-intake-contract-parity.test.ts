import { describe, expect, it } from "vitest";
import { validatePropertyBourseFields } from "../../domain/po-intake/property-bourse-validation";
import { propertyHasIncompleteContact, validatePropertyContacts } from "../../domain/po-intake/property-validation";
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

  it("skips deed image and extra bourse fields for registered title", () => {
    const property = {
      ...emptyProperty(),
      identifierType: "real_estate_reg" as const,
      realEstateRegNumber: "12345",
      city: "الرياض",
      district: "العليا",
    };

    expect(validatePropertyBourseFields(property)).toEqual({});
  });

  it("matches the backend whole-field incomplete-contact marker check", () => {
    const markerOnly = {
      ...emptyProperty(),
      contacts: [{ name: "", role: "مالك", phone: "0500000000", nationalId: "" }],
    };
    const markerWithAnotherPhone = {
      ...emptyProperty(),
      contacts: [
        { name: "", role: "مالك", phone: "0500000000 0555555555", nationalId: "" },
      ],
    };

    expect(propertyHasIncompleteContact(markerOnly)).toBe(true);
    expect(propertyHasIncompleteContact(markerWithAnotherPhone)).toBe(false);
  });

  it("rejects an invalid contact national id with the same message as the backend", () => {
    const property = {
      ...emptyProperty(),
      contacts: [
        {
          name: "أحمد",
          role: "مالك",
          phone: "0501234567",
          nationalId: "555",
        },
      ],
    };

    expect(validatePropertyContacts(property).contact_national_id_0).toBe(
      "رقم الهوية يجب أن يتكون من 10 أرقام ويبدأ بـ 1 أو 2.",
    );
  });
});
