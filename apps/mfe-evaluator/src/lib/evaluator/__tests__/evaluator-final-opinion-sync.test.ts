import { describe, expect, it } from "vitest";
import {
  finalOpinionDraftPatch,
  legacyLandBuildingPrice,
} from "../evaluator-final-opinion-sync";

describe("finalOpinionDraftPatch (2026-11-10)", () => {
  it("always writes the current discount — 0 once the basis no longer applies one", () => {
    expect(
      finalOpinionDraftPatch(
        950_000,
        { liquidationDiscountPct: 0, liquidationDiscountApplied: false },
        { evaluatorPrice: "760000", forcedSaleDiscountPct: "20" },
      ),
    ).toEqual({ evaluatorPrice: "950000", forcedSaleDiscountPct: "0" });
  });

  it("writes the applied liquidation discount", () => {
    expect(
      finalOpinionDraftPatch(
        855_000,
        { liquidationDiscountPct: 10, liquidationDiscountApplied: true },
        { evaluatorPrice: "", forcedSaleDiscountPct: "" },
      ),
    ).toEqual({ evaluatorPrice: "855000", forcedSaleDiscountPct: "10" });
  });

  it("writes nothing when the package already holds both, or the value is not positive", () => {
    const extras = { liquidationDiscountPct: 10, liquidationDiscountApplied: true };
    expect(
      finalOpinionDraftPatch(855_000, extras, { evaluatorPrice: "855000", forcedSaleDiscountPct: "10" }),
    ).toBeNull();
    expect(finalOpinionDraftPatch(0, extras, {})).toBeNull();
    expect(finalOpinionDraftPatch(Number.NaN, extras, {})).toBeNull();
  });
});

describe("legacyLandBuildingPrice (2026-11-10)", () => {
  const legacy = { landValue: "600000", buildingValue: "400000", evaluatorPrice: "" };

  it("fills the sum only when the property has no valuation request", () => {
    expect(legacyLandBuildingPrice(legacy, false)).toBe("1000000");
  });

  it("never over a valuation request, nor when the lookup failed", () => {
    expect(legacyLandBuildingPrice(legacy, true)).toBeNull();
    expect(legacyLandBuildingPrice(legacy, null)).toBeNull();
  });

  it("never over a price already set, nor with nothing to sum", () => {
    expect(legacyLandBuildingPrice({ ...legacy, evaluatorPrice: "900000" }, false)).toBeNull();
    expect(legacyLandBuildingPrice({ landValue: "", buildingValue: "" }, false)).toBeNull();
  });
});
