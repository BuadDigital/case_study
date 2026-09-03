import { describe, expect, it } from "vitest";
import {
  createEngineeringSurveyDraft,
  ENGINEERING_SURVEY_CHECKLIST_ITEMS,
} from "../src/lib/engineering-survey-data";
import {
  isPlattedPropertyWithPlot,
  validateEngineeringSurveySubmission,
} from "../src/lib/engineering-survey-validation";

function completeSurvey() {
  const draft = createEngineeringSurveyDraft({
    taskId: "t1",
    propertyId: "p1",
    poNumber: "PO-1",
  });
  draft.surveyReportFileName = "report.pdf";
  draft.siteConfirmed = true;
  draft.deedMatchesNature = "yes";
  draft.checklist = ENGINEERING_SURVEY_CHECKLIST_ITEMS.map(() => ({
    answer: "yes" as const,
    note: "",
  }));
  return draft;
}

describe("engineering survey site letter", () => {
  it("treats a property with plan and plot numbers as platted", () => {
    expect(
      isPlattedPropertyWithPlot({ planNumber: "1234", plotNumber: "56" }),
    ).toBe(true);
    expect(
      isPlattedPropertyWithPlot({ planNumber: "1234", plotNumber: "" }),
    ).toBe(false);
    expect(
      isPlattedPropertyWithPlot({ planNumber: "", plotNumber: "56" }),
    ).toBe(false);
  });

  it("requires the site letter unless the property is platted with a plot number", () => {
    const draft = completeSurvey();
    expect(validateEngineeringSurveySubmission(draft).site_letter).toBe(
      "ارفع خطاب إقرار صحة الموقع",
    );
    expect(
      validateEngineeringSurveySubmission(draft, { siteLetterRequired: false })
        .site_letter,
    ).toBeUndefined();
  });
});
