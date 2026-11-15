import { describe, expect, it } from "vitest";
import type {
  ValuationComparableAdjustmentLineDto,
  ValuationComparableSelectionDto,
  ValuationComparableSelectionListDto,
} from "@platform/api-client";
import {
  addableFactorOptions,
  grossAdjustmentPct,
  matrixBasisView,
  matrixFactorRows,
} from "../adjustments-matrix-state";
import { AUTO_AREA_KEYS, LAND_AREA_KEY } from "../factor-registry";
import {
  autoAreaPct,
  ensureLinesForSave,
  lineForSave,
  linePercent,
  marketSaveBody,
} from "../market-save-mappers";

// A built subject's two area lines (Omar 2026-11-15): the building's area and the land's, each
// with its own factor and method; the server computes both percents.

const line = (
  factorKey: string,
  percent: number,
  extra: Partial<ValuationComparableAdjustmentLineDto> = {},
): ValuationComparableAdjustmentLineDto => ({
  id: factorKey,
  factorKey,
  labelAr: factorKey,
  percent,
  rationale: "",
  isIncluded: true,
  sortOrder: 0,
  isSuggestedValue: false,
  ...extra,
});

const villa = (extra: Partial<ValuationComparableSelectionDto> = {}) =>
  ({
    id: "sel-1",
    comparablePropertyId: "comp-1",
    isAdopted: true,
    areaOverrideSqm: null,
    landAreaOverrideSqm: 450,
    effectiveLandAreaSqm: 450,
    market: {
      adjustmentLines: [line("market", 1), line("area", 1.67), line(LAND_AREA_KEY, -10), line("location", 5)],
      areaAdjustmentMethod: "amthal",
      suggestedAreaAdjustmentPct: 1.67,
      landAreaAdjustmentMethod: "multiplier",
      suggestedLandAreaAdjustmentPct: -10,
      weightIsManual: false,
    },
    ...extra,
  }) as unknown as ValuationComparableSelectionDto;

const table = (extra: Partial<ValuationComparableSelectionListDto> = {}) =>
  ({
    selectionContext: "market",
    adjustmentBasis: "whole_property",
    weightedPricePerSqm: 1_500_000,
    marketOpinionValue: 1_500_000,
    marketOpinionValueRaw: 1_500_000,
    subjectAreaSqm: 400,
    areaFactorPct: 5,
    twoAreaAdjustments: true,
    subjectLandAreaSqm: 600,
    subjectLandAreaIsManual: false,
    landAreaFactorPct: 10,
    ...extra,
  }) as unknown as ValuationComparableSelectionListDto;

describe("matrixBasisView — a built subject's two area rows", () => {
  it("names the first row after the building and gives each row its own method and factor", () => {
    const view = matrixBasisView(table(), [villa()], "400", "building");
    expect(view.twoAreas).toBe(true);
    expect(view.areaRowLabel).toBe("مساحة المباني");
    expect(view.areaMethod).toBe("طريقة الأمثال — آلية");
    expect(view.areaFactor).toBe(5);
    expect(view.landAreaMethod).toBe("طريقة المضاعف — آلية");
    expect(view.landAreaFactor).toBe(10);
  });

  it("names the first row after the apartment for a unit", () => {
    expect(matrixBasisView(table(), [villa()], "180", "unit").areaRowLabel).toBe("مساحة الشقة");
  });

  it("applies an area method on the whole-property basis too — it used to say there is none", () => {
    const view = matrixBasisView(table(), [villa()], "400", "building");
    expect(view.isUnit).toBe(false);
    expect(view.areaMethod).not.toContain("لا تسوية مساحة");
  });

  it("says where the subject's land area came from, or that it is missing", () => {
    expect(matrixBasisView(table(), [villa()], "400", "building").subjectLandAreaNote).toBe(
      "مساحة الأرض — من الصك",
    );
    expect(
      matrixBasisView(table({ subjectLandAreaIsManual: true }), [villa()], "400", "building")
        .subjectLandAreaNote,
    ).toBe("مساحة الأرض — مُدخلة");
    const missing = matrixBasisView(table({ subjectLandAreaSqm: null }), [villa()], "400", "building");
    expect(missing.subjectLandArea).toBeNull();
    expect(missing.subjectLandAreaNote).toBe("أدخل مساحة الأرض");
  });

  it("keeps a table with one area line as it was", () => {
    const view = matrixBasisView(table({ twoAreaAdjustments: false }), [villa()], "400", "building");
    expect(view.twoAreas).toBe(false);
    expect(view.areaRowLabel).toBe("المساحة");
    expect(view.areaMethod).toBe("لا تسوية مساحة — المقارنة على قيمة العقار كاملة");
  });
});

describe("the land line among the matrix rows", () => {
  it("is drawn on its own, never as a typed difference factor", () => {
    const rows = matrixFactorRows(["market", "area", LAND_AREA_KEY, "location"]);
    expect(rows.differenceKeys).toEqual(["location"]);
    expect(AUTO_AREA_KEYS.has(LAND_AREA_KEY)).toBe(true);
  });

  it("is never offered as a factor to add", () => {
    expect(addableFactorOptions([]).map((f) => f.factorKey)).not.toContain(LAND_AREA_KEY);
  });

  it("counts in the gross adjustment beside the building's line", () => {
    // |1| + |1.67| + |−10| + |5|
    expect(grossAdjustmentPct(villa())).toBe(17.67);
  });
});

describe("saving a comparable of a two-line table", () => {
  it("reads both area percents from the server's figures", () => {
    expect(autoAreaPct(villa(), "area")).toBe(1.67);
    expect(autoAreaPct(villa(), LAND_AREA_KEY)).toBe(-10);
    expect(autoAreaPct(villa(), "location")).toBeNull();
    const noLine = villa({ market: { ...villa().market!, adjustmentLines: [] } });
    expect(linePercent(noLine, LAND_AREA_KEY)).toBe(-10);
  });

  it("pins the land line to the computed figure, whatever the line carried", () => {
    const stale = line(LAND_AREA_KEY, 99);
    expect(lineForSave(villa(), stale, 2).percent).toBe(-10);
  });

  it("keeps the land line and its ✓ when another cell is saved", () => {
    const off = villa({
      market: {
        ...villa().market!,
        adjustmentLines: [line("area", 1.67), line(LAND_AREA_KEY, -10, { isIncluded: false }), line("location", 5)],
      },
    });
    const lines = ensureLinesForSave(off, "location", 7, []);
    expect(lines.map((l) => [l.factorKey, l.isIncluded])).toEqual([
      ["area", true],
      [LAND_AREA_KEY, false],
      ["location", true],
    ]);
  });

  it("sends the comparable's land area on every save, so the server does not clear it", () => {
    expect(marketSaveBody(villa(), []).landAreaOverrideSqm).toBe(450);
    expect(marketSaveBody(villa({ landAreaOverrideSqm: null }), []).landAreaOverrideSqm).toBeNull();
  });
});
