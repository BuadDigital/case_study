import { describe, expect, it, vi } from "vitest";

import { formatCashAdjustment } from "../../../../../lib/evaluator/area-cash-adjustment";
import { areaCashRateSource } from "../area-cash-rates";
import { runMatrixAction } from "../matrix-actions";

/** Where a cash area row's rate starts from (2026-11-16, curriculum 105 examples 11 and 16). */
describe("areaCashRateSource", () => {
  const cost = {
    landUnitRateFromMarket: 750,
    landEstimateComplete: true,
    buildingsValueAfterDepreciation: 150_000,
    buildingAreaSqm: 200,
  };

  it("takes the land comparables' adjusted rate for the land row", () => {
    expect(areaCashRateSource(cost, "land")).toEqual({ rate: 750, label: "من جدول مقارنات الأراضي" });
  });

  it("takes the buildings after depreciation per floor m² for the building row", () => {
    // Example 11: 200 × 1,000 less 25٪ = 150,000 → 750 per m².
    expect(areaCashRateSource(cost, "area")).toEqual({ rate: 750, label: "من أسلوب التكلفة بعد الإهلاك" });
  });

  it("gives nothing while the source is incomplete", () => {
    expect(areaCashRateSource(null, "land")).toBeNull();
    expect(areaCashRateSource({ ...cost, landEstimateComplete: false }, "land")).toBeNull();
    expect(areaCashRateSource({ ...cost, buildingAreaSqm: 0 }, "area")).toBeNull();
    expect(areaCashRateSource({ ...cost, buildingsValueAfterDepreciation: 0 }, "area")).toBeNull();
  });
});

describe("formatCashAdjustment", () => {
  it("prints the sign and the riyals", () => {
    expect(formatCashAdjustment(37_500)).toBe("+37,500 ر.س");
    expect(formatCashAdjustment(-22_500)).toBe("−22,500 ر.س");
    expect(formatCashAdjustment(0)).toBe("0 ر.س");
    expect(formatCashAdjustment(undefined)).toBe("0 ر.س");
  });
});

describe("the area method and rate commands", () => {
  it("reach their own operations with the row", async () => {
    const ops = { saveAreaMethod: vi.fn(), saveAreaCashRate: vi.fn() };
    await runMatrixAction(ops as never, "market", { type: "area-method-change", method: "cash", line: "land" });
    await runMatrixAction(ops as never, "market", { type: "area-cash-rate-change", value: "750" });
    expect(ops.saveAreaMethod).toHaveBeenCalledWith("cash", "land");
    expect(ops.saveAreaCashRate).toHaveBeenCalledWith("750", undefined);
  });
});
