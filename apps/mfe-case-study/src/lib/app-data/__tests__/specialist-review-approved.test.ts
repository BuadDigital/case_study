import { describe, expect, it } from "vitest";
import type { CaseStudyReportDraft } from "../case-study-report-model";

function markSpecialistPartyReviewOnAnswer(
  draft: CaseStudyReportDraft,
  key: string,
  value: "A" | "B" | null,
): CaseStudyReportDraft {
  const next: CaseStudyReportDraft = {
    ...draft,
    answers: { ...draft.answers, [key]: value },
  };
  if (value === "A" || value === "B") {
    next.specialistReviewApproved = {
      ...draft.specialistReviewApproved,
      [key]: true,
    };
  }
  return next;
}

describe("specialistReviewApproved", () => {
  it("marks party review approved when specialist sets official answer", () => {
    const draft: CaseStudyReportDraft = {
      taskId: "task-1",
      status: "draft",
      currentStep: 0,
      requestNumber: "",
      requestDate: "",
      deedNumber: "",
      answers: {},
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
      specialistReviewApproved: {},
    };

    const updated = markSpecialistPartyReviewOnAnswer(draft, "deed_2", "A");
    expect(updated.specialistReviewApproved?.deed_2).toBe(true);
    expect(updated.answers.deed_2).toBe("A");
  });

  it("does not mark review when answer is cleared", () => {
    const draft: CaseStudyReportDraft = {
      taskId: "task-1",
      status: "draft",
      currentStep: 0,
      requestNumber: "",
      requestDate: "",
      deedNumber: "",
      answers: { deed_2: "A" },
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
      specialistReviewApproved: { deed_2: true },
    };

    const updated = markSpecialistPartyReviewOnAnswer(draft, "deed_2", null);
    expect(updated.specialistReviewApproved?.deed_2).toBe(true);
    expect(updated.answers.deed_2).toBeNull();
  });
});
