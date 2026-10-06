import { describe, expect, it } from "vitest";
import {
  applyReportDraftChoices,
  overlayFromDraft,
  pickSpecialistChoices,
  depositCodeForPrint,
  reportDateForPrint,
  SPECIALIST_REPORT_CHOICE_KEYS,
  versionedReportNo,
} from "../report-draft-choices";
import { createEvaluatorDraft, emptyReportChoices } from "../evaluator-window-data";

function submission() {
  return createEvaluatorDraft({ taskId: "t1", propertyId: "p1", poNumber: "PO-1" });
}

describe("report draft choices", () => {
  it("only the print attachment keys belong to the specialist — ESG stays the appraiser's", () => {
    expect([...SPECIALIST_REPORT_CHOICE_KEYS]).toEqual([
      "printAttachmentKeys",
      "printAttachmentOrder",
      "printAttachmentDocIds",
      "reportSlotAssignments",
      "reportSlotFrames",
    ]);
    const picked = pickSpecialistChoices({ ...emptyReportChoices(), purposeKey: "sale" });
    expect(Object.keys(picked).sort()).toEqual([...SPECIALIST_REPORT_CHOICE_KEYS].sort());
    expect("purposeKey" in picked).toBe(false);
    expect("esgEnv" in picked).toBe(false);
  });

  it("the overlay replaces the print attachments and leaves the appraiser's own choices (ESG included) alone", () => {
    const base = submission();
    const esgEnv = { none: false, selected: ["كفاءة الطاقة"], notes: "أثر بيئي محدود" };
    const withOwn = {
      ...base,
      reportChoices: { ...emptyReportChoices(), purposeKey: "sale", methodsRationale: "تعليل المقيّم", esgEnv },
    };
    const merged = applyReportDraftChoices(withOwn, {
      printAttachmentKeys: ["deed"],
    });
    expect(merged.reportChoices.esgEnv.notes).toBe("أثر بيئي محدود");
    expect(merged.reportChoices.printAttachmentKeys).toEqual(["deed"]);
    expect(merged.reportChoices.purposeKey).toBe("sale");
    expect(merged.reportChoices.methodsRationale).toBe("تعليل المقيّم");
  });

  it("no overlay returns the submission untouched", () => {
    const base = submission();
    expect(applyReportDraftChoices(base, null)).toBe(base);
    expect(applyReportDraftChoices(base, undefined)).toBe(base);
  });

  it("the overlay read from a draft keeps only the allow-listed keys that are present", () => {
    expect(overlayFromDraft(null)).toBeNull();
    expect(overlayFromDraft({ specialistChoices: {} })).toBeNull();
    expect(
      overlayFromDraft({ specialistChoices: { purposeKey: "x", printAttachmentKeys: ["deed"] } }),
    ).toEqual({ printAttachmentKeys: ["deed"] });
  });

  it("the printed report date is the approved one once approved", () => {
    const base = { appraisalDate: "2026-09-01", reportIssueDate: "2026-09-02" };
    expect(reportDateForPrint(base, { status: "approved", reportDate: "2026-10-05" })).toBe("2026-10-05");
    expect(reportDateForPrint(base, { status: "sent", reportDate: null })).toBe("2026-09-01");
    expect(reportDateForPrint({ appraisalDate: "", reportIssueDate: "2026-09-02" }, null)).toBe("2026-09-02");
  });

  it("a new version keeps the report number and adds the version", () => {
    expect(versionedReportNo("VR-123", 1)).toBe("VR-123");
    expect(versionedReportNo("VR-123", undefined)).toBe("VR-123");
    expect(versionedReportNo("VR-123", 2)).toBe("VR-123 نسخة 2");
    expect(versionedReportNo("", 2)).toBe("");
  });

  it("only the recorded deposit code is printed", () => {
    expect(depositCodeForPrint({ depositCode: "  QYM-1 " })).toBe("QYM-1");
    expect(depositCodeForPrint({ depositCode: null })).toBe("");
    expect(depositCodeForPrint(null)).toBe("");
  });
});
