import { describe, expect, it } from "vitest";
import type { BuildingInventoryLineDto } from "@platform/api-client";
import {
  SPECIALIST_COMPONENTS_TABLE_REQUIRED,
  SPECIALIST_COMPONENTS_TEXT_REQUIRED,
  componentLineForItem,
  componentLineForTypedName,
  componentLinesIssue,
  emptyComponentLine,
  infathBuildingAreasFromComponents,
  inspectedAssetIsLand,
  inspectionHasStructures,
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

  it("gates acceptance on the report text first, then on the inventory table for structures", () => {
    // the text is always required, whatever the property is
    expect(specialistComponentsMissing({ componentsText: " ", lines: [] }, true)).toBe(
      SPECIALIST_COMPONENTS_TEXT_REQUIRED,
    );
    expect(specialistComponentsMissing({ componentsText: "", lines: [line("ground_floor", "200")] }, false)).toBe(
      SPECIALIST_COMPONENTS_TEXT_REQUIRED,
    );
    // a building (or a plot with a guard room) without a single inventory line cannot be accepted
    expect(specialistComponentsMissing({ componentsText: "فيلا", lines: [] }, true)).toBe(
      SPECIALIST_COMPONENTS_TABLE_REQUIRED,
    );
    expect(
      specialistComponentsMissing({ componentsText: "فيلا", lines: [line("ground_floor", "200")] }, true),
    ).toBeNull();
    // vacant land declared by the inspector is exempt from the table
    expect(specialistComponentsMissing({ componentsText: "أرض فضاء", lines: [] }, false)).toBeNull();
  });

  it("a non-land asset always needs the table; a land asset only on the inspector's explicit yes (mirrors the server)", () => {
    // non-land: required whatever the land answer says
    expect(inspectionHasStructures({ assetSubject: "فيلا" })).toBe(true);
    expect(inspectionHasStructures({ assetSubject: "فيلا", landHasValuableStructures: "no" })).toBe(true);
    expect(inspectionHasStructures({})).toBe(true);
    expect(inspectionHasStructures({ assetSubject: "" })).toBe(true);
    // land + yes: the table is required even though the asset is land
    expect(inspectionHasStructures({ assetSubject: "أرض", landHasValuableStructures: "yes" })).toBe(true);
    // land + no, no answer, and a legacy land with no such key: exempt
    expect(inspectionHasStructures({ assetSubject: "أرض", landHasValuableStructures: "no" })).toBe(false);
    expect(inspectionHasStructures({ assetSubject: "أرض", landHasValuableStructures: "" })).toBe(false);
    expect(inspectionHasStructures({ assetSubject: "أرض" })).toBe(false);
    expect(inspectionHasStructures({ assetSubject: "أرض", landHasValuableStructures: null })).toBe(false);
  });

  it("tells whether the inspected asset is land from the inspector's answer only", () => {
    expect(inspectedAssetIsLand("أرض")).toBe(true);
    expect(inspectedAssetIsLand("فيلا")).toBe(false);
    expect(inspectedAssetIsLand("")).toBe(false);
    expect(inspectedAssetIsLand(undefined)).toBe(false);
  });

  it("flags only rows without a name", () => {
    expect(componentLinesIssue([{ ...emptyComponentLine(0), label: "دور" }])).toBeNull();
    expect(componentLinesIssue([line("custom", "10")])).toBe("اكتب اسم البند في السطر 1");
    expect(componentLinesIssue([line("ground_floor", "10")])).toBeNull();
  });

  it("a typed catalog name behaves like the picked item", () => {
    const typed = componentLineForTypedName(emptyComponentLine(0), "الدور الأرضي");
    expect(typed).toMatchObject({ itemKey: "ground_floor", structureKind: "floor", unit: "sqm", label: "الدور الأرضي" });
    // alef-hamza variants and extra spaces still match
    expect(componentLineForTypedName(emptyComponentLine(0), "  السور ").itemKey).toBe("fence");
    expect(componentLineForTypedName(emptyComponentLine(0), "الاملحق العلوي").itemKey).toBe("custom");
    expect(componentLineForTypedName(emptyComponentLine(0), "الملحق العلوي")).toMatchObject({
      itemKey: "upper_annex",
      structureKind: "annex",
    });
  });

  it("any other typed name is a custom item that keeps its unit and drops catalog-only fields", () => {
    const floor = { ...line("first_floor", "100"), buildRatioPct: 80 };
    const custom = componentLineForTypedName(floor, "غرفة حارس");
    expect(custom).toMatchObject({
      itemKey: "custom",
      label: "غرفة حارس",
      unit: "sqm",
      structureKind: "other",
      buildRatioPct: null,
      repeatedFloorCount: null,
    });
    // keeps typing: a custom line stays custom and keeps its kind
    expect(componentLineForTypedName(custom, "غرفة حارس ٢")).toMatchObject({ itemKey: "custom", structureKind: "other" });
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
