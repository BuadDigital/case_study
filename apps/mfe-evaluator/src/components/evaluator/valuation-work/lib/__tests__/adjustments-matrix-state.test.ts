import { describe, expect, it } from "vitest";
import type { ValuationComparableSelectionDto } from "@platform/api-client";
import { addableFactorOptions, buildMatrixAlerts } from "../adjustments-matrix-state";
import { weightsSumTo100 } from "../weights";

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
