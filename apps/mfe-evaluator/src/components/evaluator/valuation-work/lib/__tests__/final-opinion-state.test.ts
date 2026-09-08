import { describe, expect, it } from "vitest";
import { workOrderPremiseKey } from "../final-opinion-state";

describe("workOrderPremiseKey", () => {
  it("reads the work-order selection ahead of a saved reconciliation", () => {
    expect(
      workOrderPremiseKey({
        poPremise: "hau",
        reconPremise: "current",
        assignmentType: "تنفيذ",
      }),
    ).toBe("hau");
  });

  it("falls back to the assignment default when nothing is stored", () => {
    expect(workOrderPremiseKey({ assignmentType: "قطاع خاص" })).toBe("current");
    expect(workOrderPremiseKey({ assignmentType: "تنفيذ" })).toBe("orderly");
  });
});
