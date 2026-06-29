import { describe, expect, it } from "vitest";
import type { FieldDictionaryFieldDto } from "@platform/api-client";
import {
  DEFAULT_CASE_STUDY_QUESTION_CATALOG,
  buildDefaultCaseStudyQuestionCatalog,
  mergeFieldDictionaryIntoCaseStudyCatalog,
  questionLabelFromCatalog,
} from "../case-study-question-catalog";

describe("case-study-question-catalog", () => {
  it("builds default labels from property fields catalog", () => {
    const catalog = buildDefaultCaseStudyQuestionCatalog();
    expect(catalog.labelsByKey.deed_0).toBe("هل الصك فعال");
    expect(catalog.sectionQuestions.deed.length).toBeGreaterThan(0);
    expect(catalog.sectionKeys.deed[0]).toBe("deed_0");
  });

  it("merges API field dictionary labels by key", () => {
    const base = DEFAULT_CASE_STUDY_QUESTION_CATALOG;
    const merged = mergeFieldDictionaryIntoCaseStudyCatalog(base, [
      { key: "deed_0", name: "صك فعّال (محدّث)" },
      { key: "unrelated_field", name: "يتجاهل" },
      { key: "survey_2", name: "" },
    ] as FieldDictionaryFieldDto[]);

    expect(merged.labelsByKey.deed_0).toBe("صك فعّال (محدّث)");
    expect(merged.sectionQuestions.deed[0]).toBe("صك فعّال (محدّث)");
    expect(merged.labelsByKey.unrelated_field).toBeUndefined();
    expect(merged.labelsByKey.survey_2).toBe(base.labelsByKey.survey_2);
  });

  it("questionLabelFromCatalog falls back when key missing", () => {
    expect(
      questionLabelFromCatalog(
        DEFAULT_CASE_STUDY_QUESTION_CATALOG,
        "deed_0",
      ),
    ).toBe("هل الصك فعال");
    expect(
      questionLabelFromCatalog(
        DEFAULT_CASE_STUDY_QUESTION_CATALOG,
        "missing_key",
        "fallback",
      ),
    ).toBe("fallback");
  });
});
