import { describe, expect, it } from "vitest";
import type { CaseStudyFormDto } from "@platform/api-client";
import {
  CASE_STUDY_ANSWER_NOTES_KEY,
  caseStudyFormDraftToDto,
  caseStudyFormDtoToDraft,
  emptyCaseStudyFormDraft,
  mergeCaseStudyAnswersPayload,
  splitCaseStudyAnswersPayload,
} from "../case-study-form-model";

describe("case-study answer notes payload", () => {
  it("round-trips a row note through the answers JSON map", () => {
    const draft = emptyCaseStudyFormDraft("t1");
    draft.answers.deed_0 = "B";
    draft.answerNotes = { deed_0: "الحد الجنوبي أقصر من الصك" };

    const dto = caseStudyFormDraftToDto(draft);
    expect(dto.answers[CASE_STUDY_ANSWER_NOTES_KEY]).toEqual({
      deed_0: "الحد الجنوبي أقصر من الصك",
    });
    expect(dto.answers.deed_0).toBe("B");

    const loaded = caseStudyFormDtoToDraft(dto);
    expect(loaded.answers.deed_0).toBe("B");
    expect(loaded.answerNotes).toEqual({
      deed_0: "الحد الجنوبي أقصر من الصك",
    });
    expect(loaded.answers[CASE_STUDY_ANSWER_NOTES_KEY as never]).toBeUndefined();
  });

  it("drops empty notes and ignores the reserved key as an answer", () => {
    const merged = mergeCaseStudyAnswersPayload(
      { deed_0: "A", extra_1: null },
      { deed_0: "   ", extra_1: "ملاحظة فنية" },
    );
    expect(merged.deed_0).toBe("A");
    expect(merged[CASE_STUDY_ANSWER_NOTES_KEY]).toEqual({
      extra_1: "ملاحظة فنية",
    });

    const split = splitCaseStudyAnswersPayload(merged);
    expect(split.answers).toEqual({ deed_0: "A", extra_1: null });
    expect(split.answerNotes).toEqual({ extra_1: "ملاحظة فنية" });
  });

  it("loads a form that never stored notes", () => {
    const dto = {
      taskId: "t1",
      status: "draft",
      currentStep: 0,
      requestNumber: "",
      requestDate: "",
      deedNumber: "",
      answers: { deed_0: "A" },
      deedRemarks: "",
      surveyRemarks: "",
      componentsRemarks: "",
      occupancyRemarks: "",
      meterType: "",
      meterNumber: "",
      hoaFee: "",
      sigDeed: "",
      sigApprover: "",
      sigDate: "",
    } as CaseStudyFormDto;
    const loaded = caseStudyFormDtoToDraft(dto);
    expect(loaded.answers).toEqual({ deed_0: "A" });
    expect(loaded.answerNotes).toEqual({});
  });
});
