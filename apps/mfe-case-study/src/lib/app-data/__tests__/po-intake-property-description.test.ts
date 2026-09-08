import { describe, expect, it } from "vitest";
import { buildPropertyDescriptionLine } from "../po-intake-boundaries";

describe("buildPropertyDescriptionLine", () => {
  it("names deed area as land area, not buildings", () => {
    expect(
      buildPropertyDescriptionLine({
        propertyType: "فيلا",
        classification: "سكني",
        area: "500",
        district: "النرجس",
        bourseDataCompleted: true,
      }),
    ).toBe(
      "فيلا سكني، مساحة الأرض 500 م²، بحي النرجس. يُحدَّث الوصف التفصيلي من تقرير المعاين.",
    );
  });
});
