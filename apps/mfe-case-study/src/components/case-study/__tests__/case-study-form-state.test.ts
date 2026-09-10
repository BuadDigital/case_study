import { DeedNatureMatchOutcomes } from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import { describe, expect, it } from "vitest";
import { emptyCaseStudyFormDraft } from "../../../lib/app-data/case-study-form-model";
import { caseStudyAnswerKey } from "../../../lib/app-data/case-study-form-data";
import {
  firstCaseStudyFormScrollTarget,
  type SectionQuestions,
} from "../case-study-form-state";
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

describe("firstCaseStudyFormScrollTarget", () => {
  it("sends the specialist to deed-nature match when the outcome is empty", () => {
    const draft = emptyCaseStudyFormDraft("t1");
    draft.answers[caseStudyAnswerKey("deed", 0)] = "A";
    draft.answers[caseStudyAnswerKey("survey", 0)] = "A";
    const hit = firstCaseStudyFormScrollTarget({
      draft,
      sectionQuestions: sections,
      isQuestionVisible: () => true,
      property: traditionalProperty,
      isParty: false,
    });
    expect(hit?.targetId).toBe("cs-deed-nature-match");
    expect(hit?.step).toBe(0);
    expect(hit?.blocking).toBe(true);
    expect(hit?.message).toMatch(/تقييم العقار/);
  });

  it("sends the specialist to match notes when فروق lacks an explanation", () => {
    const draft = emptyCaseStudyFormDraft("t1");
    draft.answers[caseStudyAnswerKey("deed", 0)] = "A";
    draft.answers[caseStudyAnswerKey("survey", 0)] = "A";
    draft.deedNatureMatchOutcome = DeedNatureMatchOutcomes.Differences;
    const hit = firstCaseStudyFormScrollTarget({
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
    const draft = emptyCaseStudyFormDraft("t1");
    draft.answers[caseStudyAnswerKey("deed", 0)] = "A";
    draft.answers[caseStudyAnswerKey("survey", 0)] = "A";
    draft.deedNatureMatchOutcome = DeedNatureMatchOutcomes.Differences;
    draft.deedNatureMatchNotes = "فرق في الحد الشمالي";
    const hit = firstCaseStudyFormScrollTarget({
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

  it("sends the specialist to deed remarks when غير مطابق has no note", () => {
    const draft = emptyCaseStudyFormDraft("t1");
    draft.answers[caseStudyAnswerKey("deed", 0)] = "B";
    const hit = firstCaseStudyFormScrollTarget({
      draft,
      sectionQuestions: sections,
      isQuestionVisible: () => true,
      property: traditionalProperty,
      isParty: false,
    });
    expect(hit?.targetId).toBe("cs-deed-remarks");
    expect(hit?.step).toBe(0);
    expect(hit?.blocking).toBe(true);
  });

  it("skips the nature-match gate for registered title", () => {
    const draft = emptyCaseStudyFormDraft("t1");
    draft.answers[caseStudyAnswerKey("deed", 0)] = "A";
    draft.answers[caseStudyAnswerKey("survey", 0)] = "A";
    expect(
      firstCaseStudyFormScrollTarget({
        draft,
        sectionQuestions: sections,
        isQuestionVisible: () => true,
        property: registeredProperty,
        isParty: false,
      }),
    ).toBeNull();
  });
});
