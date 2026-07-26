import { describe, expect, it } from "vitest";
import { amountToArabicWords } from "../arabic-amount-words";
import {
  computeForcedSaleValue,
  computePropertyTotal,
} from "../value-estimation";

describe("amountToArabicWords", () => {
  it("handles zero", () => {
    expect(amountToArabicWords(0)).toBe("صفر ريال سعودي");
    expect(amountToArabicWords("")).toBe("—");
  });

  it("converts common amounts", () => {
    expect(amountToArabicWords(1)).toContain("واحد");
    expect(amountToArabicWords(1000)).toContain("ألف");
    expect(amountToArabicWords(1_250_000)).toContain("مليون");
  });
});

describe("value estimation math", () => {
  it("sums land and building", () => {
    expect(computePropertyTotal("1000000", "250000")).toBe(1_250_000);
  });

  it("applies forced-sale discount", () => {
    expect(computeForcedSaleValue(1_000_000, "20")).toBe(800_000);
  });
});
