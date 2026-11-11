import { describe, expect, it } from "vitest";
import { reviewCorrectionOptions } from "../review-correction-model";

const base = {
  studyIssued: true,
  hasAppraisal: true,
  valuationHandedOver: true,
  reviewLock: null,
} as const;

describe("reviewCorrectionOptions — «طلب تصحيح» (Omar 2026-11-11)", () => {
  it("offers the study and the valuation, each with its action and who it touches", () => {
    const [study, valuation] = reviewCorrectionOptions(base);

    expect(study).toMatchObject({ source: "study", title: "دراسة الحالة", unavailable: null });
    expect(study!.affected[0]).toMatch(/^دارس العقار/);
    expect(study!.affected[1]).toMatch(/^المقيّم — يُبلَّغ/);
    expect(valuation).toMatchObject({ source: "valuation", title: "التقييم", unavailable: null });
    expect(valuation!.affected[0]).toMatch(/^المقيّم — يصحّح/);
  });

  it("tells the appraiser's share of a study return by where his valuation stands", () => {
    const [handedOver] = reviewCorrectionOptions(base);
    const [notYet] = reviewCorrectionOptions({ ...base, valuationHandedOver: false });
    const [noAppraiser] = reviewCorrectionOptions({ ...base, hasAppraisal: false, valuationHandedOver: false });

    expect(handedOver!.affected.join(" ")).toContain("تقييمه المسلَّم يبقى كما هو");
    expect(notYet!.affected.join(" ")).toContain("لا يسلّم تقييمه حتى تصدر الدراسة من جديد");
    expect(noAppraiser!.affected).toHaveLength(1);
  });

  it("lists what cannot be returned yet with its reason", () => {
    const [study] = reviewCorrectionOptions({ ...base, studyIssued: false });
    const [, notHandedOver] = reviewCorrectionOptions({ ...base, valuationHandedOver: false });
    const [, noAppraiser] = reviewCorrectionOptions({ ...base, hasAppraisal: false, valuationHandedOver: false });

    expect(study!.unavailable).toBe("لم يرسل دارس العقار الدراسة بعد.");
    expect(notHandedOver!.unavailable).toBe("لم يسلّم المقيّم تقييمه بعد.");
    expect(noAppraiser!.unavailable).toBe("لم يُعيَّن مقيّم لهذه المعاملة.");
  });

  it("returns nothing once the appraiser gave the report his final approval", () => {
    const options = reviewCorrectionOptions({ ...base, reviewLock: "report-approved" });

    expect(options.every((o) => o.unavailable?.includes("إعادة فتح المعاملة"))).toBe(true);
  });

  it("says the draft is with the appraiser when a valuation return would cross it", () => {
    const [, sent] = reviewCorrectionOptions({ ...base, draft: { status: "sent" } });
    const [, preparing] = reviewCorrectionOptions({ ...base, draft: { status: "preparing" } });

    expect(sent!.affected[1]).toContain("عند المقيّم الآن");
    expect(preparing!.affected[1]).not.toContain("عند المقيّم الآن");
  });
});
