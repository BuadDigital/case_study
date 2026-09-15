import { describe, expect, it } from "vitest";
import { liveBankMoney, sanitizeAmountInput } from "../bank-ranking";

describe("liveBankMoney", () => {
  it("derives unit price from committed price and area", () => {
    expect(
      liveBankMoney({ committedPrice: 1960000, committedArea: 800 }),
    ).toEqual({ price: 1960000, area: 800, unit: 2450 });
  });

  it("recalculates unit while the price draft is still focused", () => {
    expect(
      liveBankMoney({
        committedPrice: 1960000,
        committedArea: 800,
        priceDraft: "2400000",
      }).unit,
    ).toBe(3000);
  });

  it("recalculates unit while the area draft is still focused", () => {
    expect(
      liveBankMoney({
        committedPrice: 1960000,
        committedArea: 800,
        areaDraft: "1000",
      }).unit,
    ).toBe(1960);
  });

  it("recalculates total price when the unit draft is typed", () => {
    expect(
      liveBankMoney({
        committedPrice: 1960000,
        committedArea: 800,
        unitDraft: "2500",
      }),
    ).toEqual({ price: 2000000, area: 800, unit: 2500 });
  });

  it("accepts Arabic digits in the input sanitizer", () => {
    expect(sanitizeAmountInput("٢٤٥٠.٥")).toBe("2450.5");
  });
});
