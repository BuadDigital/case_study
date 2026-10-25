import { describe, expect, it } from "vitest";
import {
  HANDOVER_REFUSED_PREFIX,
  classifyHandOverBlockers,
  handOverRefusalMessage,
} from "../handover-blockers";

const gate = (code: string, detailAr: string | null, passed = false) => ({
  code,
  labelAr: `بوابة ${code}`,
  passed,
  isHard: true,
  isWarning: false,
  detailAr,
});
const alert = (number: number, blocksIssuance: boolean) => ({
  number,
  code: `m${number}`,
  labelAr: `تنبيه ${number}`,
  triggered: true,
  isHard: false,
  evaluated: true,
  blocksIssuance,
  detailAr: null,
});

describe("classifyHandOverBlockers (D2)", () => {
  it("names who fixes each blocker and defers only the specialist's report attachments", () => {
    const blockers = classifyHandOverBlockers({
      gates: [
        gate("final_opinion", "الرأي النهائي غير محسوب أو صفر"),
        gate("required_attachments", "مرفقات إلزامية بلا رفع مصنّف للطباعة: صك الملكية"),
        gate("participant_credentials", "عضوية مشارك منتهية"),
        gate("deed_nature_match", null),
        gate("value_documents", "مستندات ذات قيمة غير معتمدة"),
        gate("min_adopted_comparables_land_within_cost", "يلزم مقارن أرض"),
        gate("comparable_weights_market", "≠ 100٪"),
        gate("reconciliation_weights", "ok", true),
      ],
      methodologyAlerts: [alert(16, true), alert(7, false)],
    });

    expect(blockers.map((b) => [b.code, b.owner, b.blocksHandOver, b.screen])).toEqual([
      ["final_opinion", "appraiser", true, "final"],
      ["required_attachments", "specialist_after_handover", false, null],
      ["participant_credentials", "administration", true, null],
      ["deed_nature_match", "specialist", true, null],
      ["value_documents", "value_documents", true, null],
      ["min_adopted_comparables_land_within_cost", "appraiser", true, "cost"],
      ["comparable_weights_market", "appraiser", true, "market"],
      ["m16", "appraiser", true, null],
    ]);
    // A gate without a detail falls back to its label; an alert carries its number for its screen.
    expect(blockers[3]!.text).toBe("بوابة deed_nature_match");
    expect(blockers[7]!.alertNumber).toBe(16);
    expect(blockers[1]!.ownerLabel).toBe("سيكملها الأخصائي بعد التسليم");
  });

  it("refuses with every blocker numbered in Latin digits, each saying who fixes it", () => {
    const message = handOverRefusalMessage(
      classifyHandOverBlockers({
        gates: [
          gate("final_opinion", "الرأي النهائي غير محسوب أو صفر"),
          gate("required_attachments", "صك الملكية"),
          gate("credentials", "انتهت عضوية المقيّم"),
        ],
        methodologyAlerts: [alert(15, true)],
      }),
    );
    expect(message).toBe(
      HANDOVER_REFUSED_PREFIX +
        "1) الرأي النهائي غير محسوب أو صفر — يعالجها: المقيّم؛ " +
        "2) انتهت عضوية المقيّم — يعالجها: إدارة المنشأة (اعتمادات المقيّمين)؛ " +
        "3) 15. تنبيه 15 — يعالجها: المقيّم",
    );
    expect(message).not.toMatch(/[٠-٩]/);
  });

  it("lets the hand-over through when only the specialist's later work is missing", () => {
    expect(
      handOverRefusalMessage(
        classifyHandOverBlockers({
          gates: [gate("required_attachments", "صك الملكية")],
          methodologyAlerts: [],
        }),
      ),
    ).toBeNull();
  });
});
