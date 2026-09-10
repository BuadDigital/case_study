import { describe, expect, it } from "vitest";
import { formatPropertyTypeLine } from "../po-intake-property-model";

describe("formatPropertyTypeLine", () => {
  it("joins type then usage as in «فيلا / سكنية»", () => {
    expect(
      formatPropertyTypeLine({
        propertyType: "فيلا",
        classification: "سكنية",
      }),
    ).toBe("فيلا / سكنية");
  });

  it("returns the one filled side when the other is blank", () => {
    expect(
      formatPropertyTypeLine({ propertyType: "فيلا", classification: "  " }),
    ).toBe("فيلا");
    expect(
      formatPropertyTypeLine({ propertyType: "", classification: "سكني" }),
    ).toBe("سكني");
  });

  it("does not duplicate when type and usage are the same", () => {
    expect(
      formatPropertyTypeLine({
        propertyType: "سكني",
        classification: "سكني",
      }),
    ).toBe("سكني");
  });

  it("prefers the inspector-confirmed type over the initial intake type", () => {
    expect(
      formatPropertyTypeLine({
        propertyType: "ارض",
        classification: "سكني",
        inspectedPropertyType: "فيلا",
        effectivePropertyType: "فيلا",
      }),
    ).toBe("فيلا / سكني");
  });
});
