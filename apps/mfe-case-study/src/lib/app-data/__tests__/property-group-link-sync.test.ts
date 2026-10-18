import { describe, expect, it } from "vitest";
import { linkSyncSummaryAr } from "../property-group-link-sync";

describe("linkSyncSummaryAr", () => {
  it("says nothing moved when both deeds were already complete", () => {
    expect(linkSyncSummaryAr(null)).toBe("تم تأكيد الربط — لا بيانات ناقصة في أي من الصكين");
    expect(
      linkSyncSummaryAr({
        subjectFieldsFilled: [],
        targetFieldsFilled: [],
        contactsCopiedToSubject: false,
        contactsCopiedToTarget: false,
        inspectorSlotsFilledOnSubject: 0,
        inspectorSlotsFilledOnTarget: 0,
      }),
    ).toBe("تم تأكيد الربط — لا بيانات ناقصة في أي من الصكين");
  });

  it("lists what travelled, counting fields and documents across both directions", () => {
    const text = linkSyncSummaryAr(
      {
        subjectFieldsFilled: ["finishingType"],
        targetFieldsFilled: ["ownerName", "city", "district"],
        contactsCopiedToSubject: false,
        contactsCopiedToTarget: true,
        inspectorSlotsFilledOnSubject: 0,
        inspectorSlotsFilledOnTarget: 6,
      },
      { toSubject: 0, toTarget: 2 },
    );
    expect(text).toBe(
      "تم تأكيد الربط ونُقل إلى الصك الآخر ما كان ناقصًا: 4 حقول بيانات، جهات الاتصال، 2 مستندات، مدخلات المعاين",
    );
  });

  it("uses the singular for one field or one document", () => {
    const text = linkSyncSummaryAr(
      {
        subjectFieldsFilled: [],
        targetFieldsFilled: ["ownerName"],
        contactsCopiedToSubject: false,
        contactsCopiedToTarget: false,
        inspectorSlotsFilledOnSubject: 0,
        inspectorSlotsFilledOnTarget: 0,
      },
      { toSubject: 1, toTarget: 0 },
    );
    expect(text).toContain("1 حقل بيانات");
    expect(text).toContain("1 مستند");
  });
});
