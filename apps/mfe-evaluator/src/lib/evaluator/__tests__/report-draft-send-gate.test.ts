import { describe, expect, it } from "vitest";
import { missingSpecialistDocuments } from "../report-draft-send-gate";

const gate = (code: string, passed: boolean, detailAr: string | null = null) => ({
  code,
  labelAr: `بوابة ${code}`,
  passed,
  isHard: true,
  isWarning: false,
  detailAr,
});

describe("missingSpecialistDocuments (round 2 — send waits on the specialist's documents)", () => {
  it("names the missing required report documents", () => {
    expect(
      missingSpecialistDocuments({
        gates: [
          gate("final_opinion", false, "الرأي النهائي غير محسوب أو صفر"),
          gate("required_attachments", false, "مرفقات إلزامية بلا رفع مصنّف للطباعة: صك الملكية"),
        ],
      }),
    ).toBe("مرفقات إلزامية بلا رفع مصنّف للطباعة: صك الملكية");
  });

  it("lets the send through when the documents are in place or the gates are unknown", () => {
    expect(missingSpecialistDocuments({ gates: [gate("required_attachments", true)] })).toBeNull();
    expect(missingSpecialistDocuments({ gates: [gate("final_opinion", false, "x")] })).toBeNull();
    expect(missingSpecialistDocuments(null)).toBeNull();
  });
});
