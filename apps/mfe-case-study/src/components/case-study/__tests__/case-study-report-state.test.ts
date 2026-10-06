import { DeedNatureMatchOutcomes } from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import { describe, expect, it } from "vitest";
import { emptyCaseStudyReportDraft } from "../../../lib/app-data/case-study-report-model";
import { caseStudyAnswerKey } from "../../../lib/app-data/case-study-report-data";
import {
  caseStudyIncompleteMessage,
  firstCaseStudyReportScrollTarget,
  firstMissingQuestionLocation,
  type SectionQuestions,
} from "../case-study-report-state";
import type { PoPropertyIntake } from "../../../lib/app-data/po-intake-data";

const sections: SectionQuestions = {
  deed: ["سؤال الصك"],
  survey: ["سؤال المساحة"],
  comp: [],
  occ: [],
  extra: [],
};

const traditionalProperty = {
  realEstateRegNumber: "",
  identifierType: "deed",
} as PoPropertyIntake;

const registeredProperty = {
  realEstateRegNumber: "1234567890",
  identifierType: "real_estate_reg",
} as PoPropertyIntake;

describe("firstCaseStudyReportScrollTarget", () => {
  it("sends the specialist to deed-nature match when the outcome is empty", () => {
    const draft = emptyCaseStudyReportDraft("t1");
    draft.answers[caseStudyAnswerKey("deed", 0)] = "A";
    draft.answers[caseStudyAnswerKey("survey", 0)] = "A";
    const hit = firstCaseStudyReportScrollTarget({
      draft,
      sectionQuestions: sections,
      isQuestionVisible: () => true,
      property: traditionalProperty,
      isParty: false,
    });
    expect(hit?.targetId).toBe("cs-deed-nature-match");
    expect(hit?.step).toBe(0);
    expect(hit?.blocking).toBe(true);
    expect(hit?.message).toMatch(/مدخلات المعاين/);
  });

  it("sends the specialist to match notes when فروق lacks an explanation", () => {
    const draft = emptyCaseStudyReportDraft("t1");
    draft.answers[caseStudyAnswerKey("deed", 0)] = "A";
    draft.answers[caseStudyAnswerKey("survey", 0)] = "A";
    draft.deedNatureMatchOutcome = DeedNatureMatchOutcomes.Differences;
    const hit = firstCaseStudyReportScrollTarget({
      draft,
      sectionQuestions: sections,
      isQuestionVisible: () => true,
      property: traditionalProperty,
      isParty: false,
    });
    expect(hit?.targetId).toBe("deed-nature-match-notes");
    expect(hit?.step).toBe(0);
    expect(hit?.blocking).toBe(true);
  });

  it("blocks the case-study report when the match is فروق with notes", () => {
    const draft = emptyCaseStudyReportDraft("t1");
    draft.answers[caseStudyAnswerKey("deed", 0)] = "A";
    draft.answers[caseStudyAnswerKey("survey", 0)] = "A";
    draft.deedNatureMatchOutcome = DeedNatureMatchOutcomes.Differences;
    draft.deedNatureMatchNotes = "فرق في الحد الشمالي";
    const hit = firstCaseStudyReportScrollTarget({
      draft,
      sectionQuestions: sections,
      isQuestionVisible: () => true,
      property: traditionalProperty,
      isParty: false,
    });
    expect(hit?.targetId).toBe("cs-deed-nature-match");
    expect(hit?.blocking).toBe(true);
    expect(hit?.message).toMatch(/مسار تعذر/);
  });

  it("does not require deed remarks when غير مطابق has no note", () => {
    const draft = emptyCaseStudyReportDraft("t1");
    draft.answers[caseStudyAnswerKey("deed", 0)] = "B";
    const hit = firstCaseStudyReportScrollTarget({
      draft,
      sectionQuestions: sections,
      isQuestionVisible: () => true,
      property: traditionalProperty,
      isParty: false,
    });
    expect(hit?.targetId).not.toBe("cs-deed-remarks");
    expect(hit?.invalidDeedRemarks).toBeFalsy();
  });

  it("skips the nature-match gate for registered title", () => {
    const draft = emptyCaseStudyReportDraft("t1");
    draft.answers[caseStudyAnswerKey("deed", 0)] = "A";
    draft.answers[caseStudyAnswerKey("survey", 0)] = "A";
    expect(
      firstCaseStudyReportScrollTarget({
        draft,
        sectionQuestions: sections,
        isQuestionVisible: () => true,
        property: registeredProperty,
        isParty: false,
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
      property: registeredProperty,
      isParty: false,
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
      property: registeredProperty,
      isParty: false,
    });
    expect(hit).toBeNull();
  });

  it("puts the deed-nature gate ahead of the matrix gaps", () => {
    const draft = emptyCaseStudyReportDraft("t1");
    const hit = firstCaseStudyReportScrollTarget({
      draft,
      sectionQuestions: sections,
      isQuestionVisible: () => true,
      property: traditionalProperty,
      isParty: false,
    });
    expect(hit?.invalidDeedNature).toBe(true);
    expect(hit?.missingAnswerKeys).toBeUndefined();
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

