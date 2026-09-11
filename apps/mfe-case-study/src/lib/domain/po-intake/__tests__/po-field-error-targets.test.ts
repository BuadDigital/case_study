import { describe, expect, it } from "vitest";
import {
  firstPoPropertyErrorTarget,
  poPropertyErrorTargetId,
} from "../po-field-error-targets";

describe("poPropertyErrorTargetId", () => {
  const prop = { id: "p1", identifierType: "deed" as const };

  it("maps boundary description and length keys to their inputs", () => {
    expect(poPropertyErrorTargetId("northBoundary", prop)).toBe(
      "bnd_desc_northBoundary",
    );
    expect(poPropertyErrorTargetId("northBoundaryLengthM", prop)).toBe(
      "bnd_len_northBoundaryLengthM",
    );
  });

  it("sends a missing «حالة الصك» to its pill group before any other field", () => {
    expect(poPropertyErrorTargetId("deedVitality", prop)).toBe("deed_vitality");
    expect(
      firstPoPropertyErrorTarget(
        { city: "المدينة مطلوبة", deedVitality: "اختر حالة الصك" },
        prop,
      ),
    ).toBe("deed_vitality");
  });

  it("keeps deed and contact targets", () => {
    expect(poPropertyErrorTargetId("deedNumber", prop)).toBe("deed_number");
    expect(poPropertyErrorTargetId("contact_phone_0", prop)).toBe(
      "po_contact_phone_0",
    );
  });
});
