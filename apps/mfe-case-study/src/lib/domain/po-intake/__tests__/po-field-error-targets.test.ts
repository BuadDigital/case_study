import { describe, expect, it } from "vitest";
import { poPropertyErrorTargetId } from "../po-field-error-targets";

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

  it("keeps deed and contact targets", () => {
    expect(poPropertyErrorTargetId("deedNumber", prop)).toBe("deed_number");
    expect(poPropertyErrorTargetId("contact_phone_0", prop)).toBe(
      "po_contact_phone_0",
    );
  });
});
