import { describe, expect, it } from "vitest";
import type {
  ValuationComparableAdjustmentLineDto,
  ValuationComparableSelectionDto,
  ValuationComparableSelectionListDto,
} from "@platform/api-client";
import {
  JUSTIFICATION_TOO_SHORT_MESSAGE,
  RESET_WEIGHTS_PATCH,
  bankOverridePatch,
  contextOfSelection,
  isFactorIncluded,
  isJustificationTooShort,
  itemsMissingFactor,
  linesWithCellPercent,
  linesWithDescription,
  linesWithFactorAppended,
  linesWithIncluded,
  linesWithRationaleOverride,
  linesWithoutFactor,
  manualWeightPatch,
  marketApproachBody,
  nextSubjectSpecs,
  savedLines,
  withAdoptionFlag,
  withFactorIncluded,
} from "../market-commands-state";
import { LAND_WITHIN_COST, MARKET_CONTEXT } from "../shell-state";

function line(
  factorKey: string,
  percent: number,
  extra: Partial<ValuationComparableAdjustmentLineDto> = {},
): ValuationComparableAdjustmentLineDto {
  return {
    id: `line-${factorKey}`,
    factorKey,
    labelAr: `label ${factorKey}`,
    percent,
    rationale: `why ${factorKey}`,
    isIncluded: true,
    sortOrder: 99,
    ...extra,
  };
}

function item(
  id: string,
  lines: ValuationComparableAdjustmentLineDto[],
  extra: Record<string, unknown> = {},
): ValuationComparableSelectionDto {
  return {
    id,
    comparablePropertyId: `comp-${id}`,
    isAdopted: true,
    market: {
      adjustmentLines: lines,
      suggestedAreaAdjustmentPct: 4,
      weightIsManual: false,
      weightOverrideRationale: "stored weight rationale",
    },
    ...extra,
  } as unknown as ValuationComparableSelectionDto;
}

function list(items: ValuationComparableSelectionDto[], adoptedCount = 1) {
  return { adoptedCount, items } as unknown as ValuationComparableSelectionListDto;
}

const FACTOR_ROWS = [
  { factorKey: "market", labelAr: "السوق" },
  { factorKey: "area", labelAr: "المساحة" },
  { factorKey: "location", labelAr: "الموقع" },
];

describe("marketApproachBody", () => {
  it("parses the Arabic decimal comma and blanks the empty narrative", () => {
    expect(
      marketApproachBody({
        subjectArea: "312,5",
        adjustmentBasis: "price_per_sqm",
        analysisNotes: "   ",
      }),
    ).toEqual({
      subjectAreaSqm: 312.5,
      adjustmentBasis: "price_per_sqm",
      analysisNotes: null,
    });
  });

  it("sends null for a non-numeric area and lets the extra field win", () => {
    expect(
      marketApproachBody(
        { subjectArea: "abc", adjustmentBasis: "price_per_sqm", analysisNotes: "note" },
        { adjustmentBasis: "whole_property", areaFactorPct: 1.5 },
      ),
    ).toEqual({
      subjectAreaSqm: null,
      adjustmentBasis: "whole_property",
      analysisNotes: "note",
      areaFactorPct: 1.5,
    });
  });
});

describe("nextSubjectSpecs", () => {
  it("sets a trimmed description and clears it on blank text", () => {
    const specs = { location: "قريب من الطريق" };
    expect(nextSubjectSpecs(specs, "age", "  10 سنوات ")).toEqual({
      location: "قريب من الطريق",
      age: "10 سنوات",
    });
    expect(nextSubjectSpecs(specs, "location", "   ")).toEqual({});
    expect(specs).toEqual({ location: "قريب من الطريق" });
  });
});

describe("isJustificationTooShort", () => {
  it("rejects only a non-empty text under the minimum length", () => {
    expect(isJustificationTooShort("")).toBe(false);
    expect(isJustificationTooShort("قصير")).toBe(true);
    expect(isJustificationTooShort("مبرر جوهري كافٍ")).toBe(false);
    expect(JUSTIFICATION_TOO_SHORT_MESSAGE).toContain("10");
  });
});

describe("contextOfSelection", () => {
  it("routes land-table items to the cost approach", () => {
    const land = item("l1", []);
    expect(contextOfSelection(land, [land])).toBe(LAND_WITHIN_COST);
    expect(contextOfSelection(item("m1", []), [land])).toBe(MARKET_CONTEXT);
  });
});

describe("withAdoptionFlag", () => {
  it("flips the flag of the matching comparable and moves the count", () => {
    const prev = list([item("a", []), item("b", [], { isAdopted: false })], 1);
    const next = withAdoptionFlag(prev, "comp-b", true);
    expect(next.adoptedCount).toBe(2);
    expect(next.items.map((i) => i.isAdopted)).toEqual([true, true]);
    expect(prev.items[1].isAdopted).toBe(false);
  });

  it("never drives the count below zero", () => {
    expect(withAdoptionFlag(list([item("a", [])], 0), "comp-a", false).adoptedCount).toBe(0);
  });
});

describe("withFactorIncluded / isFactorIncluded", () => {
  it("patches the factor on adopted items only and reads the flag from the first item", () => {
    const prev = list([
      item("a", [line("market", 1), line("location", 2)]),
      item("b", [line("location", 3)], { isAdopted: false }),
    ]);
    const next = withFactorIncluded(prev, "location", false);
    expect(next.items[0].market?.adjustmentLines.map((l) => l.isIncluded)).toEqual([true, false]);
    expect(next.items[1].market?.adjustmentLines[0].isIncluded).toBe(true);
    expect(isFactorIncluded(next.items, "location")).toBe(false);
    expect(isFactorIncluded(next.items, "market")).toBe(true);
    expect(isFactorIncluded(next.items, "missing")).toBe(true);
    expect(isFactorIncluded([], "location")).toBe(true);
  });
});

describe("bankOverridePatch", () => {
  it("parses a positive override and keeps the other field", () => {
    const it1 = item("a", [], { priceOverrideSar: 900000, areaOverrideSqm: 250 });
    expect(bankOverridePatch(it1, "area", "300,5")).toEqual({
      priceOverrideSar: 900000,
      areaOverrideSqm: 300.5,
    });
  });

  it("clears the field on blank or non-positive input", () => {
    const it1 = item("a", [], { priceOverrideSar: 900000 });
    expect(bankOverridePatch(it1, "price", "")).toEqual({
      priceOverrideSar: null,
      areaOverrideSqm: null,
    });
    expect(bankOverridePatch(it1, "price", "-5").priceOverrideSar).toBeNull();
  });
});

describe("savedLines", () => {
  it("pins area to the suggestion, zeroes suggested values and reindexes sort order", () => {
    const lines = savedLines(
      item("a", [
        line("market", 1),
        line("area", 9),
        line("type", -5, { isSuggestedValue: true }),
      ]),
    );
    expect(lines.map((l) => [l.factorKey, l.percent, l.sortOrder])).toEqual([
      ["market", 1, 0],
      ["area", 4, 1],
      ["type", 0, 2],
    ]);
    expect(lines[0]).not.toHaveProperty("isSuggestedValue");
    expect(lines[0].descriptionAr).toBeNull();
  });

  it("returns an empty list when the comparable has no market data", () => {
    expect(savedLines({ id: "x" } as ValuationComparableSelectionDto)).toEqual([]);
  });
});

describe("linesWithCellPercent", () => {
  it("materialises missing factor rows and writes the entered percent", () => {
    const lines = linesWithCellPercent(item("a", [line("market", 1)]), "location", -3, FACTOR_ROWS);
    expect(lines.map((l) => [l.factorKey, l.percent])).toEqual([
      ["market", 1],
      ["area", 4],
      ["location", -3],
    ]);
    expect(lines[2].labelAr).toBe("الموقع");
  });
});

describe("linesWithoutFactor / linesWithFactorAppended", () => {
  it("drops the factor and reindexes", () => {
    const lines = linesWithoutFactor(item("a", [line("market", 1), line("type", 2), line("location", 3)]), "type");
    expect(lines.map((l) => [l.factorKey, l.sortOrder])).toEqual([
      ["market", 0],
      ["location", 1],
    ]);
  });

  it("appends a fresh 0% line after the existing ones", () => {
    const lines = linesWithFactorAppended(item("a", [line("market", 1)]), "view", "الإطلالة");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({
      factorKey: "view",
      labelAr: "الإطلالة",
      percent: 0,
      rationale: "",
      descriptionAr: null,
      isIncluded: true,
      sortOrder: 1,
    });
    expect(lines[1].id).toBeTruthy();
  });
});

describe("linesWithDescription", () => {
  it("writes the trimmed description on the matching line only", () => {
    const lines = linesWithDescription(
      item("a", [line("market", 1, { descriptionAr: "old" }), line("location", 2)]),
      "location",
      "  شارع تجاري ",
    );
    expect(lines.map((l) => l.descriptionAr)).toEqual(["old", "شارع تجاري"]);
    expect(linesWithDescription(item("a", [line("location", 2, { descriptionAr: "x" })]), "location", " ")[0].descriptionAr).toBeNull();
  });
});

describe("linesWithRationaleOverride", () => {
  it("writes the override without turning a suggested value into a manual percent", () => {
    const lines = linesWithRationaleOverride(
      item("a", [line("market", 1), line("type", -5, { isSuggestedValue: true })]),
      "type",
      "مبرر خاص بهذا المقارن",
      FACTOR_ROWS,
    );
    const type = lines.find((l) => l.factorKey === "type");
    expect(type).toMatchObject({ percent: 0, rationale: "مبرر خاص بهذا المقارن" });
    expect(lines.find((l) => l.factorKey === "market")).toMatchObject({ percent: 1, rationale: "why market" });
    expect(lines.map((l) => l.factorKey)).toEqual(["market", "type", "area", "location"]);
  });

  it("keeps the stored percent when the line was entered manually", () => {
    const lines = linesWithRationaleOverride(item("a", [line("location", 7)]), "location", "text", FACTOR_ROWS);
    expect(lines.find((l) => l.factorKey === "location")).toMatchObject({ percent: 7, rationale: "text" });
  });
});

describe("linesWithIncluded", () => {
  it("sets the flag on the factor and keeps other suggested lines suggested (zeroed)", () => {
    const lines = linesWithIncluded(
      item("a", [line("market", 1), line("type", -5, { isSuggestedValue: true }), line("location", 3)]),
      "location",
      false,
      FACTOR_ROWS,
    );
    expect(lines.find((l) => l.factorKey === "location")).toMatchObject({ isIncluded: false, percent: 3 });
    expect(lines.find((l) => l.factorKey === "type")).toMatchObject({ isIncluded: true, percent: 0 });
    expect(lines.find((l) => l.factorKey === "market")).toMatchObject({ isIncluded: true, percent: 1 });
  });
});

describe("itemsMissingFactor", () => {
  it("keeps only comparables without a line for the factor", () => {
    const has = item("a", [line("view", 0)]);
    const missing = item("b", [line("market", 1)]);
    expect(itemsMissingFactor([has, missing], "view")).toEqual([missing]);
  });
});

describe("weight patches", () => {
  it("parses the manual weight and falls back to the stored rationale", () => {
    expect(manualWeightPatch(item("a", []), "35,5", "  ")).toEqual({
      weightIsManual: true,
      weightPct: 35.5,
      weightOverrideRationale: "stored weight rationale",
    });
    expect(manualWeightPatch(item("a", []), "abc", "جديد")).toMatchObject({
      weightPct: 0,
      weightOverrideRationale: "جديد",
    });
  });

  it("resets to the automatic suggestion", () => {
    expect(RESET_WEIGHTS_PATCH).toEqual({
      weightIsManual: false,
      weightPct: null,
      weightOverrideRationale: null,
    });
  });
});
