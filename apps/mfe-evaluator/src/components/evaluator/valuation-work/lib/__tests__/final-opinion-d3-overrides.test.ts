import { describe, expect, it } from "vitest";
import {
  LIQUIDATION_DISCOUNT_MESSAGES,
  LIQUIDATION_DISCOUNT_NAME,
  alertOverridesForCodes,
  finalOpinionDraftDiffers,
  forcedSaleDiscountOpinionLine,
  liquidationDiscountSaveErrors,
  syncDiscountLineInOpinion,
} from "../final-opinion-state";

describe("liquidationDiscountSaveErrors (D3)", () => {
  const save = (basis: string, pct: string, rationale = "") =>
    liquidationDiscountSaveErrors({
      basisOfValueKey: basis,
      liquidationDiscountPct: pct,
      liquidationDiscountRationale: rationale,
    });

  it("a 0 discount is valid on every basis but liquidation", () => {
    expect(save("market", "0")).toBeNull();
    expect(save("investment", "")).toBeNull();
  });

  it("on the liquidation basis a 0 (or empty) discount is refused at save", () => {
    expect(save("liquidation", "0")).toEqual({
      liquidationDiscountPct: LIQUIDATION_DISCOUNT_MESSAGES.requiredForLiquidation,
    });
    expect(save("liquidation", "")).toEqual({
      liquidationDiscountPct: LIQUIDATION_DISCOUNT_MESSAGES.requiredForLiquidation,
    });
  });

  it("asks for the rationale of a positive discount, and range-checks Arabic digits too", () => {
    expect(save("liquidation", "١٠")).toEqual({
      liquidationDiscountRationale: LIQUIDATION_DISCOUNT_MESSAGES.rationaleRequired,
    });
    expect(save("liquidation", "10", "مزاد")).toBeNull();
    expect(save("liquidation", "120", "مزاد")).toEqual({
      liquidationDiscountPct: LIQUIDATION_DISCOUNT_MESSAGES.range,
    });
  });

  it("every message and the opinion line use the one name «خصم التصفية»", () => {
    for (const message of Object.values(LIQUIDATION_DISCOUNT_MESSAGES)) {
      expect(message).toContain(LIQUIDATION_DISCOUNT_NAME);
    }
    expect(forcedSaleDiscountOpinionLine(10)).toBe("طُبِّق خصم التصفية 10٪.");
    // A line written under the old name is still replaced, not duplicated.
    const old = "طُبِّق خصم بيع قسري 20٪.\nأساس القيمة المستخدم: قيمة التصفية.";
    const next = syncDiscountLineInOpinion(old, 15);
    expect(next).toBe("طُبِّق خصم التصفية 15٪.\nأساس القيمة المستخدم: قيمة التصفية.");
  });
});

describe("alertOverridesForCodes (problem 20)", () => {
  it("sends this screen's dispositions only — trimmed, deduplicated, unanswered as not acknowledged", () => {
    expect(
      alertOverridesForCodes(
        {
          m7: { overrideRationale: "  مبرر  ", acknowledged: false },
          m12: { overrideRationale: "", acknowledged: true },
          m3: { overrideRationale: "من شاشة أخرى", acknowledged: false },
        },
        ["m7", "m12", "m7", "m16"],
      ),
    ).toEqual([
      { code: "m7", overrideRationale: "مبرر", acknowledged: false },
      { code: "m12", overrideRationale: null, acknowledged: true },
      { code: "m16", overrideRationale: null, acknowledged: false },
    ]);
  });
});

describe("finalOpinionDraftDiffers (problem 19)", () => {
  const recon = {
    methodsRationale: "مبرر محفوظ",
    finalRoundDecimals: 3,
    liquidationDiscountPct: 10,
    liquidationDiscountRationale: "مزاد",
    methods: [{ approachKind: "market", weightPct: 100, isIncluded: true }],
  };
  const drafts = {
    recon,
    methodsRationale: "مبرر محفوظ",
    finalRoundDecimals: "3",
    liquidationDiscountPct: "10",
    liquidationDiscountRationale: "مزاد",
    reconMethods: [{ approachKind: "market", weightPct: 100, isIncluded: true }],
  };

  it("matches the saved reconciliation — nothing to warn about", () => {
    expect(finalOpinionDraftDiffers(drafts)).toBe(false);
  });

  it("typed rationale, discount or weights that are not saved yet count as unsaved", () => {
    expect(finalOpinionDraftDiffers({ ...drafts, methodsRationale: "مبرر جديد" })).toBe(true);
    expect(finalOpinionDraftDiffers({ ...drafts, liquidationDiscountPct: "15" })).toBe(true);
    expect(
      finalOpinionDraftDiffers({
        ...drafts,
        reconMethods: [{ approachKind: "market", weightPct: 90, isIncluded: true }],
      }),
    ).toBe(true);
    expect(finalOpinionDraftDiffers({ ...drafts, recon: null, methodsRationale: "" , liquidationDiscountRationale: "" })).toBe(false);
    expect(finalOpinionDraftDiffers({ ...drafts, recon: null })).toBe(true);
  });
});
