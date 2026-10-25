import { describe, expect, it } from "vitest";
import { emptyCaseStudyReportDraft } from "../../../lib/app-data/case-study-report-model";
import { caseStudyAnswerKey } from "../../../lib/app-data/case-study-report-data";
import {
  CASE_STUDY_DEED_MATCH_REQUIRED_MESSAGE,
  caseStudyDeedMatchIssueBlock,
  caseStudyIncompleteMessage,
  firstCaseStudyReportScrollTarget,
  firstMissingQuestionLocation,
  type SectionQuestions,
} from "../case-study-report-state";

const sections: SectionQuestions = {
  deed: ["سؤال الصك"],
  survey: ["سؤال المساحة"],
  comp: [],
  occ: [],
  extra: [],
};

describe("firstCaseStudyReportScrollTarget", () => {
  it("does not require deed remarks when غير مطابق has no note", () => {
    const draft = emptyCaseStudyReportDraft("t1");
    draft.answers[caseStudyAnswerKey("deed", 0)] = "B";
    const hit = firstCaseStudyReportScrollTarget({
      draft,
      sectionQuestions: sections,
      isQuestionVisible: () => true,
    });
    expect(hit?.targetId).not.toBe("cs-deed-remarks");
    expect(hit?.invalidDeedRemarks).toBeFalsy();
  });

  it("leaves the deed-nature match to caseStudyDeedMatchIssueBlock (D16 — it lives on another tab)", () => {
    // Decision 2026-10-15 — an empty outcome on a traditional deed used to block the issue.
    const draft = emptyCaseStudyReportDraft("t1");
    draft.answers[caseStudyAnswerKey("deed", 0)] = "A";
    draft.answers[caseStudyAnswerKey("survey", 0)] = "A";
    expect(
      firstCaseStudyReportScrollTarget({
        draft,
        sectionQuestions: sections,
        isQuestionVisible: () => true,
      }),
    ).toBeNull();
  });
});

describe("firstCaseStudyReportScrollTarget matrix gaps", () => {
  it("blocks the issue on an unanswered visible question and names N of M", () => {
    const draft = emptyCaseStudyReportDraft("t1");
    draft.answers[caseStudyAnswerKey("deed", 0)] = "A";
    const hit = firstCaseStudyReportScrollTarget({
      draft,
      sectionQuestions: sections,
      isQuestionVisible: () => true,
    });
    expect(hit?.blocking).toBe(true);
    expect(hit?.targetId).toBe(`cs-q-${caseStudyAnswerKey("survey", 0)}`);
    expect(hit?.step).toBe(1);
    expect(hit?.message).toBe(caseStudyIncompleteMessage(1, 2));
    expect(hit?.message).toBe("أجب عن كل الأسئلة الظاهرة (1 من 2)");
    expect([...(hit?.missingAnswerKeys ?? [])]).toEqual([
      caseStudyAnswerKey("survey", 0),
    ]);
  });

  it("counts only the questions visible to the viewer", () => {
    const draft = emptyCaseStudyReportDraft("t1");
    draft.answers[caseStudyAnswerKey("deed", 0)] = "NA";
    const hit = firstCaseStudyReportScrollTarget({
      draft,
      sectionQuestions: sections,
      isQuestionVisible: (key) => key === caseStudyAnswerKey("deed", 0),
    });
    expect(hit).toBeNull();
  });
});

describe("firstMissingQuestionLocation", () => {
  it("returns the earliest server-missing key in form order", () => {
    const where = firstMissingQuestionLocation(
      new Set([caseStudyAnswerKey("survey", 0), caseStudyAnswerKey("deed", 0)]),
      sections,
    );
    expect(where).toEqual({ key: caseStudyAnswerKey("deed", 0), step: 0 });
  });

  it("returns null when no key belongs to a known question", () => {
    expect(firstMissingQuestionLocation(new Set(["zzz_9"]), sections)).toBeNull();
  });
});


describe("caseStudyDeedMatchIssueBlock (D16)", () => {
  const traditional = {
    realEstateRegNumber: "",
    identifierType: "deed" as const,
    deedKind: "traditional",
  };
  const registered = { ...traditional, deedKind: "registered_title" };

  it("blocks a traditional deed until an outcome is chosen", () => {
    expect(caseStudyDeedMatchIssueBlock({ outcome: "", property: traditional })).toBe(
      CASE_STUDY_DEED_MATCH_REQUIRED_MESSAGE,
    );
    expect(caseStudyDeedMatchIssueBlock({ outcome: undefined, property: traditional })).toBe(
      CASE_STUDY_DEED_MATCH_REQUIRED_MESSAGE,
    );
    expect(caseStudyDeedMatchIssueBlock({ outcome: "matched", property: traditional })).toBeNull();
    expect(caseStudyDeedMatchIssueBlock({ outcome: "differences", property: traditional })).toBeNull();
  });

  it("never blocks a registered title or an unknown property", () => {
    expect(caseStudyDeedMatchIssueBlock({ outcome: "", property: registered })).toBeNull();
    expect(caseStudyDeedMatchIssueBlock({ outcome: "", property: null })).toBeNull();
  });
});
