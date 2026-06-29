import { describe, expect, it } from "vitest";
import {
  appraiserOnlyCaseStudyChecklistItems,
  caseStudyAnswerToChecklistBoolean,
  evaluatorChecklistKeysForAppraiser,
  filterEvaluatorChecklistQuestions,
  mergeEvaluatorChecklistFromCaseStudy,
} from "../evaluator-checklist-case-study-sync";
import {
  EVALUATOR_CONDITIONAL_QUESTIONS,
  EVALUATOR_SIMPLE_QUESTIONS,
  emptyChecklist,
} from "../evaluator-window-data";
import { defaultCaseStudyInfoRolesMatrix } from "@settings/mfe/lib/prototype/default-case-study-info-roles-matrix";

describe("evaluator-checklist-case-study-sync", () => {
  it("maps case study A/B to checklist booleans", () => {
    expect(caseStudyAnswerToChecklistBoolean("A")).toBe(true);
    expect(caseStudyAnswerToChecklistBoolean("B")).toBe(false);
    expect(caseStudyAnswerToChecklistBoolean(null)).toBeNull();
  });

  it("fills empty checklist slots from party case study answers", () => {
    const merged = mergeEvaluatorChecklistFromCaseStudy(
      emptyChecklist(),
      {
        deed_4: "A",
        deed_7: "A",
        deed_9: "A",
        deed_10: "A",
      },
      {},
    );

    expect(merged.q_expropriation).toBe(true);
    expect(merged.q_property_use_verified).toBe(true);
    expect(merged.q_shared_deed).toBe(true);
    expect(merged.shared_deed_scope).toBe("full");
    expect(merged.q_plan_match).toBeNull();
  });

  it("overwrites linked checklist values when requested", () => {
    const base = emptyChecklist();
    base.q_property_use_verified = false;

    const merged = mergeEvaluatorChecklistFromCaseStudy(
      base,
      { deed_7: "A" },
      {},
      { overwriteLinked: true },
    );

    expect(merged.q_property_use_verified).toBe(true);
  });

  it("does not override existing evaluator checklist values by default", () => {
    const base = emptyChecklist();
    base.q_plan_match = false;

    const merged = mergeEvaluatorChecklistFromCaseStudy(base, {
      deed_2: "A",
    });

    expect(merged.q_plan_match).toBe(false);
  });

  it("filters checklist questions to those assigned to the appraiser", () => {
    const matrix = defaultCaseStudyInfoRolesMatrix();
    const assigned = filterEvaluatorChecklistQuestions(
      [...EVALUATOR_SIMPLE_QUESTIONS, ...EVALUATOR_CONDITIONAL_QUESTIONS],
      matrix,
    );
    const keys = evaluatorChecklistKeysForAppraiser(matrix);
    const extra = appraiserOnlyCaseStudyChecklistItems(matrix);

    expect(keys.has("q_expropriation")).toBe(true);
    expect(keys.has("q_property_use_verified")).toBe(true);
    expect(keys.has("q_shared_deed")).toBe(true);
    expect(keys.has("q_plan_match")).toBe(false);
    expect(assigned.map((q) => q.id)).toEqual([...keys]);
    expect(extra).toEqual([]);
    expect(assigned.length).toBeLessThan(
      EVALUATOR_SIMPLE_QUESTIONS.length + EVALUATOR_CONDITIONAL_QUESTIONS.length,
    );
  });
});
