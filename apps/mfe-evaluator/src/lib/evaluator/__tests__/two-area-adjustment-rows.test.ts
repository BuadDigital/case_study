import { describe, expect, it } from "vitest";
import type {
  ValuationComparableAdjustmentLineDto,
  ValuationComparableSelectionDto,
  ValuationComparableSelectionListDto,
} from "@platform/api-client";
import {
  buildAdjustmentRationaleText,
  buildAdjustmentSheetRows,
} from "../valuation-report-sheet-facts";

// The report's «جدول التسويات» for a built subject (Omar 2026-11-15): the building's area and the
// land's area each have a row — the comparable's own area on that row and its percent.

const line = (
  factorKey: string,
  labelAr: string,
  percent: number,
  sortOrder: number,
  isIncluded = true,
): ValuationComparableAdjustmentLineDto => ({
  id: `${factorKey}-${sortOrder}`,
  factorKey,
  labelAr,
  percent,
  rationale: "",
  isIncluded,
  sortOrder,
  isSuggestedValue: false,
});

const comparable = (
  n: number,
  area: number,
  land: number | null,
  areaPct: number,
  landPct: number,
  landIncluded = true,
) =>
  ({
    id: `sel-${n}`,
    comparablePropertyId: `comp-${n}`,
    isAdopted: true,
    comparable: { comparablePropertyType: "فيلا", district: "الملقا", areaSqm: area, price: 1_000_000 * n },
    effectiveAreaSqm: area,
    effectivePriceSar: 1_000_000 * n,
    effectiveLandAreaSqm: land,
    market: {
      adjustmentLines: [
        line("market", "تسوية ظروف السوق", 0, 0),
        line("area", "تسوية المساحة", areaPct, 1),
        line("land_area", "تسوية مساحة الأرض", landPct, 2, landIncluded),
        line("location", "الموقع", 0, 3),
      ],
      sumDifferencePct: areaPct + (landIncluded ? landPct : 0),
      pricePerSqmAfterSequential: 1_000_000 * n,
      pricePerSqmAfterDifference: 1_000_000 * n,
      effectiveWeightPct: 50,
    },
  }) as unknown as ValuationComparableSelectionDto;

const market = (extra: Partial<ValuationComparableSelectionListDto> = {}) =>
  ({
    adjustmentBasis: "whole_property",
    subjectAreaSqm: 400,
    twoAreaAdjustments: true,
    subjectLandAreaSqm: 600,
    weightedPricePerSqm: 1_500_000,
    marketOpinionValue: 1_500_000,
    factorRationales: [
      { selectionContext: "market", factorKey: "area", rationaleAr: "مسطحات متقاربة" },
      { selectionContext: "market", factorKey: "land_area", rationaleAr: "أرض المقارن الثاني ضعفان ونصف" },
    ],
    ...extra,
  }) as unknown as ValuationComparableSelectionListDto;

describe("the report's two area rows", () => {
  const comps = [comparable(1, 300, 500, 1.67, 0), comparable(2, 500, 1500, -1.25, -10)];
  const rowOf = (key: string, m = market(), list = comps) =>
    buildAdjustmentSheetRows(list, m).rows.find((r) => r.key === key);

  it("prints the building's row and the land's row, each with its own areas and percents", () => {
    const building = rowOf("تسوية مساحة المباني")!;
    expect(building.subject).toBe("400");
    expect(building.pairs).toEqual([
      ["300", "1.67٪"],
      ["500", "-1.25٪"],
    ]);
    const land = rowOf("تسوية مساحة الأرض")!;
    expect(land.subject).toBe("600");
    expect(land.pairs).toEqual([
      ["500", "0.00٪"],
      ["1,500", "-10.00٪"],
    ]);
  });

  it("puts the land's row right after the building's and prints it once", () => {
    const keys = buildAdjustmentSheetRows(comps, market()).rows.map((r) => r.key);
    expect(keys.indexOf("تسوية مساحة الأرض")).toBe(keys.indexOf("تسوية مساحة المباني") + 1);
    expect(keys.filter((k) => k === "تسوية مساحة الأرض")).toHaveLength(1);
    expect(keys).not.toContain("تسوية المساحة");
  });

  it("shows the areas with no percent on a row the appraiser left out", () => {
    const left = [comparable(1, 300, 500, 1.67, 0, false), comparable(2, 500, 1500, -1.25, -10, false)];
    expect(rowOf("تسوية مساحة الأرض", market(), left)!.pairs).toEqual([
      ["500", "—"],
      ["1,500", "—"],
    ]);
  });

  it("dashes a comparable whose land area is not known", () => {
    const unknown = [comparable(1, 300, null, 1.67, 0), comparable(2, 500, 1500, -1.25, -10)];
    expect(rowOf("تسوية مساحة الأرض", market(), unknown)!.pairs?.[0]).toEqual(["—", "0.00٪"]);
  });

  it("keeps the single «تسوية المساحة» row on a table with one area line", () => {
    const keys = buildAdjustmentSheetRows(comps, market({ twoAreaAdjustments: false })).rows.map((r) => r.key);
    expect(keys).toContain("تسوية المساحة");
    expect(keys).not.toContain("تسوية مساحة المباني");
  });

  it("lists both rows' rationales under their own names", () => {
    const text = buildAdjustmentRationaleText(comps, market());
    expect(text).toContain("تسوية مساحة المباني — مسطحات متقاربة");
    expect(text).toContain("تسوية مساحة الأرض — أرض المقارن الثاني ضعفان ونصف");
  });
});
