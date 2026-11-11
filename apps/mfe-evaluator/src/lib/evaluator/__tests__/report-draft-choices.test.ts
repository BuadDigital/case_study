import { describe, expect, it } from "vitest";
import {
  applyReportDraftChoices,
  overlayFromDraft,
  pickSpecialistChoices,
  depositCodeForPrint,
  reportDateForPrint,
  reportIsApproved,
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
    expect(versionedReportNo("PRV-2026-00123", 1)).toBe("PRV-2026-00123");
    expect(versionedReportNo("PRV-2026-00123", undefined)).toBe("PRV-2026-00123");
    expect(versionedReportNo("PRV-2026-00123", 2)).toBe("PRV-2026-00123/2");
    // A linked property's report keeps its «-L» (numbering 2026-11-08).
    expect(versionedReportNo("PRV-26-00123-L", 2)).toBe("PRV-26-00123-L/2");
    expect(versionedReportNo("", 2)).toBe("");
  });

  it("only the recorded deposit code is printed", () => {
    expect(depositCodeForPrint({ depositCode: "  QYM-1 " })).toBe("QYM-1");
    expect(depositCodeForPrint({ depositCode: null })).toBe("");
    expect(depositCodeForPrint(null)).toBe("");
  });
});

describe("reportIsApproved — when the report carries its signatures and stamp (Omar 2026-11-11)", () => {
  it("is a draft until the appraiser approves it", () => {
    expect(reportIsApproved(null)).toBe(false);
    expect(reportIsApproved({ status: "preparing", reportStage: "draft" })).toBe(false);
    expect(reportIsApproved({ status: "sent", reportStage: "draft" })).toBe(false);
  });

  it("is approved from the appraiser's approval on — the deposit copy and the final issue too", () => {
    expect(reportIsApproved({ status: "approved", reportStage: "draft" })).toBe(true);
    expect(reportIsApproved({ status: "approved", reportStage: "deposit_issued" })).toBe(true);
    expect(reportIsApproved({ status: "approved", reportStage: "final_issued" })).toBe(true);
  });
});
