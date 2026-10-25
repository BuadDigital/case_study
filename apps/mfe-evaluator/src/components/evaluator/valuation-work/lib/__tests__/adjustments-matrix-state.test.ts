import { describe, expect, it } from "vitest";
import type {
  ValuationComparableSelectionDto,
  ValuationComparableSelectionListDto,
} from "@platform/api-client";
import {
  addableFactorOptions,
  buildMatrixAlerts,
  grossAdjustmentPct,
  matrixBasisView,
} from "../adjustments-matrix-state";
import { pctClass } from "../../AdjustmentsMatrixCells.styles";
import { weightsSumTo100 } from "../weights";

const line = (factorKey: string, percent: number, isIncluded = true) => ({
  id: factorKey,
  factorKey,
  labelAr: factorKey,
  percent,
  rationale: "",
  isIncluded,
  sortOrder: 0,
  isSuggestedValue: false,
});

describe("gross adjustment (D4)", () => {
  // R2a comparable #5: market +1, area −0.63, location +30, access −30 → net −0.63, gross 61.63.
  const offsetting = {
    comparable: { referenceCode: "CMP-R2A-5" },
    market: {
      effectiveWeightPct: 100,
      sumDifferencePct: -0.63,
      exceedsLargeAdjustmentThreshold: true,
      adjustmentLines: [
        line("market", 1),
        line("financing", 4, false),
        line("area", -0.63),
        line("location", 30),
        line("access", -30),
      ],
    },
  } as unknown as ValuationComparableSelectionDto;

  it("sums the absolute included percents — +30/−30 is 61.63٪, not −0.63٪", () => {
    expect(grossAdjustmentPct(offsetting)).toBe(61.63);
  });

  it("names both the net and the gross in the matrix alert", () => {
    const [alert] = buildMatrixAlerts([offsetting], (n) => `${n}%`);
    expect(alert!.kind).toBe("error");
    expect(alert!.title).toContain("صافي التسويات -0.63%");
    expect(alert!.title).toContain("الإجمالي 61.63%");
  });
});

describe("matrixBasisView", () => {
  const list = (selectionContext: string, adjustmentBasis = "price_per_sqm") =>
    ({
      selectionContext,
      adjustmentBasis,
      weightedPricePerSqm: 4470,
      marketOpinionValue: 804559,
      marketOpinionValueRaw: 804559,
      subjectAreaSqm: 180,
      areaFactorPct: 5,
    }) as unknown as ValuationComparableSelectionListDto;

  it("labels the market table «قيمة العقار قبل التقريب» — an apartment is not land", () => {
    expect(matrixBasisView(list("market"), [], "180").outputLabel).toBe("قيمة العقار قبل التقريب");
  });

  it("keeps «قيمة الأرض قبل التقريب» for the land table inside the cost approach", () => {
    expect(matrixBasisView(list("land_within_cost"), [], "180").outputLabel).toBe("قيمة الأرض قبل التقريب");
  });

  it("says no area adjustment is applied on the whole-property basis (D7)", () => {
    expect(matrixBasisView(list("market", "whole_property"), [], "180").areaMethod).toContain(
      "لا تسوية مساحة",
    );
  });
});

describe("pctClass", () => {
  it("does not paint a small negative adjustment in danger red", () => {
    expect(pctClass(-0.45)).not.toContain("danger");
    expect(pctClass(-0.45)).toBe("text-amber-text");
    expect(pctClass(3.86)).toBe("text-[#2f7a4d]");
    expect(pctClass(0)).toBe("text-text-2");
  });
});

describe("addableFactorOptions", () => {
  it("returns a deleted default difference factor so it can be added again", () => {
    const options = addableFactorOptions([
      "ideal_area",
      "attraction",
      "access",
      "street_count",
      "street_lengths",
    ]);
    expect(options.map((f) => f.factorKey)).toContain("location");
    expect(options.map((f) => f.factorKey)).not.toContain("attraction");
    expect(options.map((f) => f.factorKey)).not.toContain("area");
    expect(options.map((f) => f.factorKey)).not.toContain("market");
  });

});

describe("weights sum — the server's ±0.05 tolerance", () => {
  it("accepts 99.95–100.05 and float noise, rejects what Math.round let through", () => {
    expect(weightsSumTo100(100)).toBe(true);
    expect(weightsSumTo100(33.33 + 33.33 + 33.34)).toBe(true);
    expect(weightsSumTo100(99.95)).toBe(true);
    expect(weightsSumTo100(100.05)).toBe(true);
    expect(weightsSumTo100(99.94)).toBe(false);
    expect(weightsSumTo100(99.5)).toBe(false);
    expect(weightsSumTo100(100.4)).toBe(false);
  });

  it("raises the matrix alert for 99.5", () => {
    const adopted = (weights: number[]) =>
      weights.map(
        (w) =>
          ({
            comparable: { referenceCode: "C" },
            market: { effectiveWeightPct: w, exceedsLargeAdjustmentThreshold: false },
          }) as unknown as ValuationComparableSelectionDto,
      );
    const fmtPct = (n: number) => `${n}%`;
    expect(buildMatrixAlerts(adopted([50, 49.5]), fmtPct)[0]!.kind).toBe("error");
    expect(buildMatrixAlerts(adopted([50, 49.96]), fmtPct)[0]!.kind).toBe("ok");
  });
});
