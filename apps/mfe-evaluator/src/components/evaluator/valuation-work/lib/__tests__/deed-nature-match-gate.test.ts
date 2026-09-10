import { describe, expect, it } from "vitest";
import type { ValuationIssuanceGatesDto } from "@platform/api-client";
import {
  deedNatureMatchBlocksValuation,
  deedNatureMatchGateDetail,
} from "../deed-nature-match-gate";

function gates(
  passed: boolean,
  detailAr?: string,
): ValuationIssuanceGatesDto {
  return {
    valuationRequestId: "vr",
    propertyId: "p",
    allowsIssuance: passed,
    gates: [
      {
        code: "deed_nature_match",
        labelAr: "مطابقة الصك والطبيعة",
        passed,
        isHard: true,
        isWarning: false,
        detailAr,
      },
    ],
    blockingReasonsAr: passed ? [] : ["blocked"],
    methodologyAlerts: [],
    methodologyAlertTriggeredCount: 0,
    methodologyAlertsNoteAr: "",
  };
}

describe("deedNatureMatchBlocksValuation", () => {
  it("does not lock while gates have not loaded", () => {
    expect(deedNatureMatchBlocksValuation(null)).toBe(false);
  });

  it("locks when the match gate failed", () => {
    expect(
      deedNatureMatchBlocksValuation(
        gates(false, "صك تقليدي — يلزم مخرج مطابق"),
      ),
    ).toBe(true);
  });

  it("unlocks when the match gate passed", () => {
    expect(deedNatureMatchBlocksValuation(gates(true))).toBe(false);
  });
});

describe("deedNatureMatchGateDetail", () => {
  it("returns the gate detail when blocked", () => {
    expect(
      deedNatureMatchGateDetail(gates(false, "يلزم مطابق")),
    ).toBe("يلزم مطابق");
  });

  it("returns null when the gate passed", () => {
    expect(deedNatureMatchGateDetail(gates(true, "ok"))).toBeNull();
  });
});
