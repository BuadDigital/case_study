import { describe, expect, it } from "vitest";
import { isMarketMethodologyAlert } from "../methodology-alerts";

describe("isMarketMethodologyAlert", () => {
  it("keeps comparable / time-gap alerts on طريقة المقارنة", () => {
    expect([15, 16, 17, 19, 20].every(isMarketMethodologyAlert)).toBe(true);
  });

  it("leaves cost and inspection alerts off the market screen", () => {
    expect(isMarketMethodologyAlert(1)).toBe(false);
    expect(isMarketMethodologyAlert(11)).toBe(false);
    expect(isMarketMethodologyAlert(18)).toBe(false);
    expect(isMarketMethodologyAlert(21)).toBe(false);
  });
});
