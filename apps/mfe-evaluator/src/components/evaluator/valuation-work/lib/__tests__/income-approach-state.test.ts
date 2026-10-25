import { describe, expect, it } from "vitest";
import type { ValuationApproachSettingsDto, ValuationIncomeApproachDto } from "@platform/api-client";

import {
  INCOME_APPROACH_LABEL,
  emptyIncomeFields,
  incomeApproachAvailable,
  incomeDerived,
  incomeFieldsFromDto,
  incomeSaveRequest,
  incomeWarnings,
  type IncomeApproachFields,
} from "../income-approach-state";
import { buildNavItems } from "../shell-state";
import { methodologyAlertGroup } from "../methodology-alerts";
import { visibleEvaluatorTabs } from "../../../evaluator-window-tabs";
import { blockerScreen } from "../../HandOverBlockersPanel";

const handCalc: IncomeApproachFields = {
  ...emptyIncomeFields(),
  grossPotentialIncome: "600000",
  vacancyPct: "5",
  otherIncome: "0",
  opexMode: "pct_of_egi",
  opexPct: "20",
  capRatePct: "7.5",
  capRateRationale: "  عوائد صفقات مكاتب مماثلة ",
};

describe("income approach — direct capitalisation (D17)", () => {
  it("hand calculation: GPI 600,000 · vacancy 5٪ · opex 20٪ of EGI · cap 7.5٪ → 6,080,000", () => {
    const d = incomeDerived(handCalc);
    expect(d.vacancyLoss).toBe(30_000);
    expect(d.effectiveGrossIncome).toBe(570_000);
    expect(d.operatingExpenses).toBe(114_000);
    expect(d.opexPctOfEgi).toBe(20);
    expect(d.netOperatingIncome).toBe(456_000);
    expect(d.value).toBe(6_080_000);
    expect(d.complete).toBe(true);
  });

  it("accepts Arabic-Indic digits and thousands separators in every box", () => {
    const d = incomeDerived({ ...handCalc, grossPotentialIncome: "٦٠٠٬٠٠٠", vacancyPct: "٥", capRatePct: "٧٫٥" });
    expect(d.value).toBe(6_080_000);
    const body = incomeSaveRequest({ ...handCalc, grossPotentialIncome: "٦٠٠٬٠٠٠", capRatePct: "٧٫٥" });
    expect(body.grossPotentialIncome).toBe(600_000);
    expect(body.capitalisationRatePct).toBe(7.5);
  });

  it("expenses as an annual amount and other income follow the same formula", () => {
    const d = incomeDerived({
      ...handCalc,
      grossPotentialIncome: "500000",
      vacancyPct: "10",
      otherIncome: "20000",
      opexMode: "amount",
      opexAmount: "120000",
      capRatePct: "8",
    });
    expect(d.effectiveGrossIncome).toBe(470_000);
    expect(d.netOperatingIncome).toBe(350_000);
    expect(d.value).toBe(4_375_000);
  });

  it("a blank cap rate is a draft (null), never zero, and yields no value", () => {
    const fields = { ...handCalc, capRatePct: "" };
    expect(incomeSaveRequest(fields).capitalisationRatePct).toBeNull();
    expect(incomeDerived(fields).value).toBe(0);
    expect(incomeDerived(fields).complete).toBe(false);
  });

  it("trims the rationale and sends null when it is blank", () => {
    expect(incomeSaveRequest(handCalc).capRateRationale).toBe("عوائد صفقات مكاتب مماثلة");
    expect(incomeSaveRequest({ ...handCalc, capRateRationale: "  " }).capRateRationale).toBeNull();
  });

  it("warns on a cap rate outside 4–12٪, expenses above half of EGI and a non-positive NOI", () => {
    expect(incomeWarnings(incomeDerived(handCalc))).toEqual([]);
    expect(incomeWarnings(incomeDerived({ ...handCalc, capRatePct: "13" }))[0]).toContain("4٪–12٪");
    expect(incomeWarnings(incomeDerived({ ...handCalc, opexPct: "60" }))[0]).toContain("50٪");
    expect(incomeWarnings(incomeDerived({ ...handCalc, opexPct: "100" })).join(" ")).toContain(
      "صافي الدخل التشغيلي صفر أو سالب",
    );
  });

  it("hydrates from a saved row and starts empty when never saved", () => {
    expect(incomeFieldsFromDto(null)).toEqual(emptyIncomeFields());
    const dto = {
      isSaved: true,
      grossPotentialIncome: 600000,
      vacancyCollectionLossPct: 5,
      otherIncome: 0,
      operatingExpensesMode: "amount",
      operatingExpensesAmount: 114000,
      operatingExpensesPct: 0,
      capitalisationRatePct: null,
      capRateRationale: null,
    } as unknown as ValuationIncomeApproachDto;
    const fields = incomeFieldsFromDto(dto);
    expect(fields.opexMode).toBe("amount");
    expect(fields.opexAmount).toBe("114000");
    expect(fields.capRatePct).toBe("");
  });

  it("the screen exists only once the settings are saved with income on", () => {
    const s = (over: Partial<ValuationApproachSettingsDto>) =>
      ({ isSaved: true, incomeApproachEnabled: true, ...over }) as ValuationApproachSettingsDto;
    expect(incomeApproachAvailable(null)).toBe(false);
    expect(incomeApproachAvailable(s({ isSaved: false }))).toBe(false);
    expect(incomeApproachAvailable(s({ incomeApproachEnabled: false }))).toBe(false);
    expect(incomeApproachAvailable(s({}))).toBe(true);
  });

  it("adds «أسلوب الدخل» to the work nav and the window tabs only when enabled", () => {
    const off = buildNavItems({ marketEnabled: true, costEnabled: true, adoptedMarketCount: 0 });
    expect(off.find((n) => n.id === "income")?.show).toBe(false);
    const on = buildNavItems({ marketEnabled: true, costEnabled: false, incomeEnabled: true, adoptedMarketCount: 0 });
    expect(on.find((n) => n.id === "income")).toMatchObject({ label: "أسلوب الدخل", show: true });
    expect(visibleEvaluatorTabs({ market: true, cost: true }).some((t) => t.id === "income")).toBe(false);
    expect(visibleEvaluatorTabs({ market: false, cost: false, income: true }).map((t) => t.id)).toContain("income");
  });

  it("alerts 26–28 are resolved on the income screen", () => {
    expect([26, 27, 28].map(methodologyAlertGroup)).toEqual(["income", "income", "income"]);
    expect(
      blockerScreen({
        key: "alert:m26",
        code: "m26",
        text: "",
        owner: "appraiser",
        ownerLabel: "",
        blocksHandOver: true,
        screen: null,
        alertNumber: 26,
      }),
    ).toBe("income");
  });

  it("prints the approach as «أسلوب الدخل (رسملة مباشرة)»", () => {
    expect(INCOME_APPROACH_LABEL).toBe("أسلوب الدخل (رسملة مباشرة)");
  });
});
