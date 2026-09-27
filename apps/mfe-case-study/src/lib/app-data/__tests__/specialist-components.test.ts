import { describe, expect, it } from "vitest";
import type { BuildingInventoryLineDto } from "@platform/api-client";
import {
  SPECIALIST_COMPONENTS_TEXT_REQUIRED,
  SPECIALIST_LINES_REQUIRED,
  componentLineForItem,
  componentLinesIssue,
  emptyComponentLine,
  infathBuildingAreasFromComponents,
  specialistComponentsMissing,
} from "../specialist-components";

function line(itemKey: string, areaSqm: string, extra: Partial<BuildingInventoryLineDto> = {}) {
  return { ...componentLineForItem(emptyComponentLine(0), itemKey), areaSqm, ...extra };
}

describe("specialist components", () => {
  it("picking an item sets its unit, kind and label", () => {
    expect(componentLineForItem(emptyComponentLine(0), "fence")).toMatchObject({
      itemKey: "fence",
      unit: "lm",
      structureKind: "fence",
      label: "السور",
    });
    expect(componentLineForItem(emptyComponentLine(0), "upper_annex").structureKind).toBe("annex");
    expect(componentLineForItem(emptyComponentLine(0), "custom").label).toBe("");
  });

  it("gates acceptance on the text, then the table (optional on land)", () => {
    expect(specialistComponentsMissing({ componentsText: " ", lines: [] }, true)).toBe(
      SPECIALIST_COMPONENTS_TEXT_REQUIRED,
    );
    expect(specialistComponentsMissing({ componentsText: "فيلا", lines: [] }, false)).toBe(
      SPECIALIST_LINES_REQUIRED,
    );
    expect(specialistComponentsMissing({ componentsText: "أرض فضاء", lines: [] }, true)).toBeNull();
    expect(
      specialistComponentsMissing({ componentsText: "فيلا", lines: [line("ground_floor", "200")] }, false),
    ).toBeNull();
  });

  it("flags legacy rows without an item and custom rows without a name", () => {
    expect(componentLinesIssue([{ ...emptyComponentLine(0), label: "دور" }])).toBe("اختر البند في السطر 1");
    expect(componentLinesIssue([line("custom", "10")])).toBe("اكتب اسم البند المخصص في السطر 1");
    expect(componentLinesIssue([line("ground_floor", "10")])).toBeNull();
  });

  it("derives the Infath building areas, repeating the first floor", () => {
    const areas = infathBuildingAreasFromComponents([
      line("ground_floor", "200"),
      line("first_floor", "180"),
      line("repeated_floors", "", { repeatedFloorCount: 2 }),
      line("basement", "150"),
      line("upper_annex", "60"),
      line("fence", "80"),
    ]);
    expect(areas).toEqual({
      builtArea: "740",
      buildingFloors: "4",
      basementTotal: "150",
      annexTotal: "60",
      buildingsTotal: "950",
    });
  });
});
