import { describe, expect, it } from "vitest";
import {
  caseStudyReopenReasonError,
  caseStudyReopenSuccessMessage,
  parseCaseStudyIssueErrors,
  parseMissingQuestionKeys,
  planCaseStudyReopenSubmit,
  reopenNeedsEnfazConfirmation,
} from "../case-study-report-issue-errors";

describe("parseCaseStudyIssueErrors", () => {
  it("splits missingQuestionKeys into a set and keeps the answers message", () => {
    const parsed = parseCaseStudyIssueErrors({
      answers: "أسئلة ناقصة: 2 من 30",
      missingQuestionKeys: "deed_1, survey_0,,survey_0",
    });
    expect([...parsed.missingQuestionKeys]).toEqual(["deed_1", "survey_0"]);
    expect(parsed.answersMessage).toBe("أسئلة ناقصة: 2 من 30");
    expect(parsed.deedNature).toBe(false);
  });

  it("flags the deed-nature keys", () => {
    const parsed = parseCaseStudyIssueErrors({
      deedNatureMatchOutcome: "مخرج المطابقة غير معروف",
      deedNatureMatchNotes: "ملاحظات المطابقة إلزامية",
    });
    expect(parsed.deedNature).toBe(true);
    expect(parsed.deedNatureNotes).toBe(true);
    expect(parsed.missingQuestionKeys.size).toBe(0);
  });

  it("is empty for a generic failure and for no errors", () => {
    const generic = parseCaseStudyIssueErrors({ _: "تعذّر الإصدار" });
    expect(generic.missingQuestionKeys.size).toBe(0);
    expect(generic.answersMessage).toBeUndefined();
    expect(parseCaseStudyIssueErrors(undefined).deedRemarks).toBe(false);
  });

  it("parseMissingQuestionKeys tolerates non-strings", () => {
    expect(parseMissingQuestionKeys(undefined).size).toBe(0);
    expect(parseMissingQuestionKeys(5).size).toBe(0);
  });
});

describe("reopen rules", () => {
  it("requires a trimmed reason of at least 10 characters", () => {
    expect(caseStudyReopenReasonError("   ")).toMatch(/إلزامي/);
    expect(caseStudyReopenReasonError("قصير")).toMatch(/10/);
    expect(caseStudyReopenReasonError("  1234567890  ")).toBeNull();
    expect(caseStudyReopenReasonError("123456789   ")).not.toBeNull();
  });

  it("reads the Enfaz handover refusal", () => {
    expect(reopenNeedsEnfazConfirmation({ enfazHandover: "سُلّمت إلى إنفاذ" })).toBe(true);
    expect(reopenNeedsEnfazConfirmation({ reason: "x" })).toBe(false);
    expect(reopenNeedsEnfazConfirmation(undefined)).toBe(false);
  });

  it("first attempt never clears the Enfaz handover", () => {
    const plan = planCaseStudyReopenSubmit({
      reason: "  سبب كافٍ للفتح  ",
      enfazPrompted: false,
      enfazConfirmed: false,
    });
    expect(plan).toEqual({
      ok: true,
      reason: "سبب كافٍ للفتح",
      clearEnfazHandover: false,
    });
  });

  it("rejects a short reason before anything else", () => {
    const plan = planCaseStudyReopenSubmit({
      reason: "قصير",
      enfazPrompted: true,
      enfazConfirmed: true,
    });
    expect(plan).toMatchObject({ ok: false, field: "reason" });
  });

  it("after the server asked, the retry needs the explicit confirmation", () => {
    const blocked = planCaseStudyReopenSubmit({
      reason: "سبب كافٍ للفتح",
      enfazPrompted: true,
      enfazConfirmed: false,
    });
    expect(blocked).toMatchObject({ ok: false, field: "enfaz" });
    const confirmed = planCaseStudyReopenSubmit({
      reason: "سبب كافٍ للفتح",
      enfazPrompted: true,
      enfazConfirmed: true,
    });
    expect(confirmed).toMatchObject({ ok: true, clearEnfazHandover: true });
  });

  it("warns in the success toast only when the appraiser had submitted", () => {
    expect(caseStudyReopenSuccessMessage(true)).toMatch(/المقيّم سلّم تقييمه/);
    expect(caseStudyReopenSuccessMessage(false)).not.toMatch(/المقيّم/);
  });
});
