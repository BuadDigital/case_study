import { describe, expect, it } from "vitest";
import { formatPropertyTypeLine } from "@platform/app-shared/app-data/po-intake-property-model";

describe("formatPropertyTypeLine", () => {
  it("shows the type alone before the inspection", () => {
    expect(formatPropertyTypeLine({ propertyType: "عمارة" })).toBe("عمارة");
  });

  it("pairs the type with the use the inspector recorded", () => {
    expect(formatPropertyTypeLine({ propertyType: "عمارة", inspectedUsage: "سكني" })).toBe("عمارة / سكني");
  });

  it("never shows the classification, which is only for the system", () => {
    const line = formatPropertyTypeLine({
      propertyType: "عمارة",
      classification: "مبنى مفرد",
    } as Parameters<typeof formatPropertyTypeLine>[0]);
    expect(line).toBe("عمارة");
  });

  it("does not duplicate when type and use are the same", () => {
    expect(formatPropertyTypeLine({ propertyType: "سكني", inspectedUsage: "سكني" })).toBe("سكني");
  });

  it("prefers the inspector-confirmed type over the initial intake type", () => {
    expect(
      formatPropertyTypeLine({
        propertyType: "أرض سكنية",
        inspectedPropertyType: "فيلا",
        effectivePropertyType: "فيلا",
        inspectedUsage: "سكني تجاري",
      }),
    ).toBe("فيلا / سكني تجاري");
  });
});
