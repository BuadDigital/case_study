import { describe, expect, it } from "vitest";
import {
  assignmentValuationDefaults,
  coercePremiseForBasis,
  isPremiseCompatibleWithBasis,
  premiseOptionsForBasis,
  resolveAssignmentValuationKeys,
} from "./assignment-valuation-defaults";

describe("assignment valuation defaults", () => {
  it("uses liquidation auction defaults for execution", () => {
    expect(assignmentValuationDefaults("تنفيذ")).toEqual({
      purposeKey: "auction_liquidation",
      basisKey: "liquidation",
      premiseKey: "orderly",
    });
  });

  it("uses sale / market defaults for private assignments", () => {
    expect(assignmentValuationDefaults("قطاع خاص")).toEqual({
      purposeKey: "sale",
      basisKey: "market",
      premiseKey: "current",
    });
  });

  it("keeps a compatible premise and replaces an incompatible one", () => {
    expect(isPremiseCompatibleWithBasis("liquidation", "forced")).toBe(true);
    expect(isPremiseCompatibleWithBasis("market", "orderly")).toBe(false);
    expect(coercePremiseForBasis("market", "orderly")).toBe("current");
    expect(coercePremiseForBasis("liquidation", "forced")).toBe("forced");
  });

  it("filters premise options to the compatible pair", () => {
    expect(premiseOptionsForBasis("liquidation").map((o) => o.value)).toEqual([
      "orderly",
      "forced",
    ]);
    expect(premiseOptionsForBasis("market").map((o) => o.value)).toEqual([
      "hau",
      "current",
    ]);
  });

  it("keeps stored overrides and fills missing keys from the assignment default", () => {
    expect(
      resolveAssignmentValuationKeys("تنفيذ", {
        purposeKey: "sale",
        basisKey: "market",
        premiseKey: "hau",
      }),
    ).toEqual({
      purposeKey: "sale",
      basisKey: "market",
      premiseKey: "hau",
    });

    expect(resolveAssignmentValuationKeys("تنفيذ")).toEqual({
      purposeKey: "auction_liquidation",
      basisKey: "liquidation",
      premiseKey: "orderly",
    });
  });
});
