import { describe, expect, it } from "vitest";
import { factorIncludedByDefault, lineIsIncluded } from "../factor-registry";

describe("factorIncludedByDefault", () => {
  it("leaves optional sequential rows off until the evaluator ticks them", () => {
    expect(factorIncludedByDefault("financing")).toBe(false);
    expect(factorIncludedByDefault("transaction_type")).toBe(false);
    expect(factorIncludedByDefault("market")).toBe(true);
    expect(factorIncludedByDefault("location")).toBe(true);
    expect(factorIncludedByDefault("custom")).toBe(true);
  });
});

describe("lineIsIncluded", () => {
  it("uses the stored flag when the line exists and the factor default when it does not", () => {
    expect(lineIsIncluded({ isIncluded: true }, "transaction_type")).toBe(true);
    expect(lineIsIncluded({ isIncluded: false }, "market")).toBe(false);
    expect(lineIsIncluded(undefined, "transaction_type")).toBe(false);
    expect(lineIsIncluded(undefined, "market")).toBe(true);
  });
});
