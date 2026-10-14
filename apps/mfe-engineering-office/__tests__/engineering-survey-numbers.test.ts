import { describe, expect, it } from "vitest";
import {
  createEngineeringSurveyDraft,
  ENGINEERING_SURVEY_CHECKLIST_ITEMS,
} from "../src/lib/engineering-survey-data";
import {
  normalizeEngineeringSurveyNumbers,
  validateEngineeringSurveySubmission,
} from "../src/lib/engineering-survey-validation";

function survey(fields: Record<string, string>) {
  const draft = createEngineeringSurveyDraft({ taskId: "t1", propertyId: "p1", poNumber: "PO-1" });
  draft.surveyReportFileName = "report.pdf";
  draft.siteConfirmed = true;
  draft.deedMatchesNature = "no";
  draft.checklist = ENGINEERING_SURVEY_CHECKLIST_ITEMS.map(() => ({ answer: "yes" as const, note: "" }));
  return { ...draft, ...fields };
}

describe("engineering survey numbers", () => {
  it("accepts Arabic digits and «٫» in coordinates; rejects junk and out-of-range", () => {
    expect(validateEngineeringSurveySubmission(survey({ latitude: "٢١٫٥", longitude: "39.1" })).latitude).toBeUndefined();
    expect(validateEngineeringSurveySubmission(survey({ latitude: "21.5abc" })).latitude).toBeDefined();
    expect(validateEngineeringSurveySubmission(survey({ latitude: "95" })).latitude).toBeDefined();
    expect(validateEngineeringSurveySubmission(survey({ longitude: "" })).longitude).toBeDefined();
  });

  it("rejects a 0 area like the server; accepts Arabic digits and grouping", () => {
    const errs = (onSiteAreaSqm: string, natureOnSiteAreaSqm = "") =>
      validateEngineeringSurveySubmission(survey({ onSiteAreaSqm, natureOnSiteAreaSqm }));
    expect(errs("0").on_site_area).toBeDefined();
    expect(errs("-5").on_site_area).toBeDefined();
    expect(errs("abc").on_site_area).toBeDefined();
    expect(errs("١٬٢٥٠ م²").on_site_area).toBeUndefined();
    expect(errs("").on_site_area).toBeUndefined();
    expect(errs("500", "0").nature_on_site_area).toBeDefined();
    expect(errs("500", "٤٥٠٫٥").nature_on_site_area).toBeUndefined();
  });

  it("sends the numbers in Latin digits so the server reads what passed here", () => {
    expect(
      normalizeEngineeringSurveyNumbers({
        latitude: "٢١٫٥",
        longitude: " 39.10 ",
        onSiteAreaSqm: "١٬٢٥٠ م²",
        natureOnSiteAreaSqm: "12,5",
        northBoundary: "شارع",
      }),
    ).toEqual({
      latitude: "21.5",
      longitude: "39.1",
      onSiteAreaSqm: "1250",
      natureOnSiteAreaSqm: "12.5",
      northBoundary: "شارع",
    });
    expect(
      normalizeEngineeringSurveyNumbers({ latitude: "", longitude: "x", onSiteAreaSqm: "" }),
    ).toEqual({ latitude: "", longitude: "x", onSiteAreaSqm: "" });
  });
});
