import { describe, expect, it } from "vitest";
import { applyCostTax, costTaxSar, statementDisplayTotal } from "../finance-cost-parties";
import { num } from "../party-fee-pricing-state";

describe("vendor statement VAT", () => {
  it("VAT and total come from the same rounding (net 1.5 → 0.23 + 1.73)", () => {
    expect(costTaxSar(1.5, "vendor")).toBe(0.23);
    expect(applyCostTax(1.5, "vendor")).toBe(1.73);
    expect(statementDisplayTotal({ totalNetSar: 1.5, payeeType: "vendor" })).toBe(1.73);
  });

  it("total = net + VAT for vendors, net alone for individuals", () => {
    for (const net of [3500.5, 12345.5, 950.5, 1000]) {
      expect(applyCostTax(net, "vendor")).toBe(
        Math.round((net + costTaxSar(net, "vendor")) * 100) / 100,
      );
    }
    expect(costTaxSar(3500.5, "vendor")).toBe(525.08);
    expect(costTaxSar(3500.5, "individual")).toBe(0);
    expect(applyCostTax(3500.5, "individual")).toBe(3500.5);
  });
});

describe("party fee pricing num()", () => {
  it("reads typed fees the one app-wide way", () => {
    expect(num("1,250")).toBe(1250);
    expect(num("١٢٥٠")).toBe(1250);
    expect(num("١٬٢٥٠٫٥")).toBe(1250.5);
    expect(num("")).toBe(0);
    expect(num("abc")).toBe(0);
    expect(num("-5")).toBe(0);
  });
});
