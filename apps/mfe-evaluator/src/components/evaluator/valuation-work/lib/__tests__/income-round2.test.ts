import { describe, expect, it } from "vitest";
import type { ValuationIncomeApproachDto } from "@platform/api-client";

import {
  emptyIncomeFields,
  incomeCapRateError,
  incomeFieldsDiffer,
  incomeSaveErrors,
  incomeScreenClosedReason,
  type IncomeApproachFields,
} from "../income-approach-state";
import {
  isRationaleBelowMinimum,
  rationaleMinimumError,
  REQUIRED_RATIONALE_MIN_LENGTH,
} from "../rationale-minimum";

const fields = (over: Partial<IncomeApproachFields>): IncomeApproachFields => ({
  ...emptyIncomeFields(),
  grossPotentialIncome: "600000",
  capRatePct: "7.5",
  ...over,
});

describe("round 2 — income screen", () => {
  it("a settings toggle switched on but not saved asks for the settings save first (item 3)", () => {
    expect(incomeScreenClosedReason({ settingsSaved: true, incomeEnabled: true, incomeSaved: false })).toContain(
      "احفظ إعدادات التقييم أولاً",
    );
    expect(incomeScreenClosedReason({ settingsSaved: true, incomeEnabled: true, incomeSaved: true })).toBeNull();
    expect(incomeScreenClosedReason({ settingsSaved: false, incomeEnabled: true, incomeSaved: false })).toBe(
      "ابدأ التقييم أولاً.",
    );
  });

  it("a cap rate above 30٪ shows the server's refusal, not a value (item 18)", () => {
    expect(incomeCapRateError(fields({ capRatePct: "35" }))).toBe(
      "معدل الرسملة يجب أن يكون أكبر من 0 ولا يتجاوز 30٪",
    );
    expect(incomeCapRateError(fields({ capRatePct: "30" }))).toBeNull();
    expect(incomeCapRateError(fields({ capRatePct: "" }))).toBeNull();
    expect(incomeSaveErrors(fields({ capRatePct: "٣٥" }))).toEqual({
      capitalisationRatePct: "معدل الرسملة يجب أن يكون أكبر من 0 ولا يتجاوز 30٪",
    });
  });

  it("alert 26 (outside 4–12٪): a written cap-rate rationale is at least 10 characters (decision B)", () => {
    expect(incomeSaveErrors(fields({ capRatePct: "15", capRateRationale: "قصير" }))).toEqual({
      capRateRationale: "مبرر معدل الرسملة يجب ألا يقل عن 10 أحرف",
    });
    expect(incomeSaveErrors(fields({ capRatePct: "15", capRateRationale: "عوائد أصول مماثلة في الحي" }))).toBeNull();
    // Inside the typical band no rationale is required.
    expect(incomeSaveErrors(fields({ capRatePct: "7", capRateRationale: "قصير" }))).toBeNull();
  });

  it("unsaved drafts are told apart from the saved row (item 4 — refresh warning)", () => {
    expect(incomeFieldsDiffer(emptyIncomeFields(), null)).toBe(false);
    expect(incomeFieldsDiffer(fields({}), null)).toBe(true);
    const saved = {
      isSaved: true,
      grossPotentialIncome: 600000,
      vacancyCollectionLossPct: null,
      otherIncome: null,
      operatingExpensesMode: "pct_of_egi",
      operatingExpensesAmount: null,
      operatingExpensesPct: null,
      capitalisationRatePct: 7.5,
      capRateRationale: null,
    } as unknown as ValuationIncomeApproachDto;
    expect(incomeFieldsDiffer(fields({}), saved)).toBe(false);
    expect(incomeFieldsDiffer(fields({ capRatePct: "8" }), saved)).toBe(true);
  });
});

describe("rationale minimum (decision B)", () => {
  it("blank is not too short; under 10 trimmed characters is; the server's wording", () => {
    expect(REQUIRED_RATIONALE_MIN_LENGTH).toBe(10);
    expect(isRationaleBelowMinimum("")).toBe(false);
    expect(isRationaleBelowMinimum("   ")).toBe(false);
    expect(isRationaleBelowMinimum("  123456789  ")).toBe(true);
    expect(isRationaleBelowMinimum("1234567890")).toBe(false);
    expect(rationaleMinimumError("مبرر الوزن اليدوي", "قصير")).toBe("مبرر الوزن اليدوي يجب ألا يقل عن 10 أحرف");
    expect(rationaleMinimumError("مبرر الوزن اليدوي", "مبرر كافٍ وواضح")).toBeNull();
  });
});
