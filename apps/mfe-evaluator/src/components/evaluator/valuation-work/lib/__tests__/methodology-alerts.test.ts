import { describe, expect, it } from "vitest";
import { methodologyAlertGroup } from "../methodology-alerts";

describe("methodologyAlertGroup", () => {
  it("keeps comparable / weight alerts on طريقة المقارنة", () => {
    expect([15, 16, 17, 19].map(methodologyAlertGroup)).toEqual(["market", "market", "market", "market"]);
  });

  it("shows the new comparable alerts (22 dispersion, 23 after the valuation date, 24 type mismatch) on the market screen", () => {
    expect([22, 23, 24].map(methodologyAlertGroup)).toEqual(["market", "market", "market"]);
  });

  it("shows 11 (built comparables for vacant land) with the market comparables it is about", () => {
    expect(methodologyAlertGroup(11)).toBe("market");
  });

  it("shows the cost alerts on the cost screen — 13 and 14 block issuance until acknowledged, 25 needs a rationale", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 25]) expect(methodologyAlertGroup(n)).toBe("cost");
  });

  it("shows inspection and use-restriction alerts with the final opinion", () => {
    for (const n of [10, 18, 21]) expect(methodologyAlertGroup(n)).toBe("general");
  });

  it("gives every backend alert number a screen", () => {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28];
    expect(numbers.every((n) => ["market", "cost", "income", "general"].includes(methodologyAlertGroup(n)))).toBe(true);
  });
});
