import { describe, expect, it } from "vitest";
import type { BuildingInventoryLineDto } from "@platform/api-client";
import {
  SPECIALIST_COMPONENTS_TEXT_REQUIRED,
  componentLineForItem,
  componentLineForTypedName,
  componentLinesIssue,
  emptyComponentLine,
  infathBuildingAreasFromComponents,
  inspectedAssetIsLand,
  inspectionHasStructures,
  nonNegativeAreaInput,
  nonNegativeDecimalInput,
  wholeCountInput,
  specialistComponentsMissing,
} from "../specialist-components";

function line(itemKey: string, areaSqm: string, extra: Partial<BuildingInventoryLineDto> = {}) {
  return { ...componentLineForItem(emptyComponentLine(0), itemKey), areaSqm, ...extra };
}

describe("specialist components", () => {
  it("an area cell never keeps a minus sign or an exponent", () => {
    expect(nonNegativeAreaInput("-1375")).toBe("1375");
    expect(nonNegativeAreaInput("-")).toBe("");
    expect(nonNegativeAreaInput("375.5")).toBe("375.5");
    expect(nonNegativeAreaInput("")).toBe("");
    expect(nonNegativeAreaInput("1e5")).toBe("15");
  });

  it("a count keeps digits only", () => {
    expect(wholeCountInput("-3")).toBe("3");
    expect(wholeCountInput("خمسة")).toBe("");
    expect(wholeCountInput("1e9")).toBe("19");
    expect(wholeCountInput("١٢")).toBe("12");
    expect(wholeCountInput("123456")).toBe("1234");
  });

  it("a measure keeps digits and one decimal point", () => {
    expect(nonNegativeDecimalInput("-5")).toBe("5");
    expect(nonNegativeDecimalInput("12٫5")).toBe("12.5");
    expect(nonNegativeDecimalInput("12,5")).toBe("12.5");
    expect(nonNegativeDecimalInput("1.2.3")).toBe("1.23");
    expect(nonNegativeDecimalInput("abc")).toBe("");
  });

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

  it("gates acceptance on the report text only — an empty inventory table never blocks", () => {
    // the text is always required, whatever the property is
    expect(specialistComponentsMissing({ componentsText: " " })).toBe(SPECIALIST_COMPONENTS_TEXT_REQUIRED);
    expect(specialistComponentsMissing({ componentsText: "" })).toBe(SPECIALIST_COMPONENTS_TEXT_REQUIRED);
    // a building without a single inventory line is accepted
    expect(specialistComponentsMissing({ componentsText: "فيلا" })).toBeNull();
    expect(specialistComponentsMissing({ componentsText: "أرض فضاء" })).toBeNull();
  });

  it("a non-land asset always shows the table; a land asset only on the inspector's explicit yes (mirrors the server)", () => {
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

  it("a unit's own area is a floor line, judged on the whole name, not the first keystroke", () => {
    // typed letter by letter, as the inspector does
    let typed = emptyComponentLine(0);
    for (const text of ["م", "مساحة", "مساحة المحل"]) typed = componentLineForTypedName(typed, text);
    expect(typed).toMatchObject({ itemKey: "custom", structureKind: "floor", label: "مساحة المحل" });
    for (const name of ["المكتب", "معرض", "مساحة الوحدة", "محل تجاري", "المستودع الرئيسي", "هنجر"]) {
      expect(componentLineForTypedName(emptyComponentLine(0), name).structureKind).toBe("floor");
    }
    // not a unit: stays an extra; renaming a unit area to something else makes it an extra again
    expect(componentLineForTypedName(emptyComponentLine(0), "مكتبة").structureKind).toBe("other");
    expect(componentLineForTypedName(typed, "مظلة سيارات").structureKind).toBe("other");
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

  it("reads areas typed in Arabic digits or with a decimal comma", () => {
    const areas = infathBuildingAreasFromComponents([
      line("ground_floor", "٢٠٠"),
      line("basement", "12,5"),
    ]);
    expect(areas.builtArea).toBe("200");
    expect(areas.basementTotal).toBe("12.5");
  });
});
