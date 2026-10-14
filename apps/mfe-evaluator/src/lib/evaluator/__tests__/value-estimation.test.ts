import { describe, expect, it } from "vitest";
import { amountToArabicWords } from "../arabic-amount-words";
import {
  computeForcedSaleValue,
  computePropertyTotal,
  parseEvaluatorAmount,
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
    expect(amountToArabicWords(1_250_000)).toContain("ريال سعودي");
    expect(amountToArabicWords(1_250_000)).not.toMatch(/ريال سعودي.*ريال سعودي/);
  });
});

describe("value estimation math", () => {
  it("sums land and building", () => {
    expect(computePropertyTotal("1000000", "250000")).toBe(1_250_000);
  });

  it("applies forced-sale discount", () => {
    expect(computeForcedSaleValue(1_000_000, "20")).toBe(800_000);
  });

  it("reads typed amounts with the shared locale rule", () => {
    expect(parseEvaluatorAmount("1,250,000")).toBe(1_250_000);
    expect(parseEvaluatorAmount("١٬٢٥٠٫٥")).toBe(1250.5);
    expect(parseEvaluatorAmount("12,5")).toBe(12.5);
    expect(parseEvaluatorAmount("")).toBeNull();
    expect(parseEvaluatorAmount("abc")).toBeNull();
    expect(computePropertyTotal("1,000,000", "٢٥٠٬٠٠٠")).toBe(1_250_000);
  });
});
