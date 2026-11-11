import { describe, expect, it } from "vitest";
import { emptyProperty } from "@platform/app-shared/app-data/po-intake-property-model";
import {
  deedMatchDissent,
  deedMatchDissentLabel,
  deedMatchOverrideReasonMessage,
  deedMatchOverrideReasonMissing,
} from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import { emptyCaseStudyReportDraft } from "@platform/app-shared/app-data/case-study-report-model";
import { estimateCaseStudyCompletion } from "../case-study-completion";
import { proposeDeedNatureMatch } from "../deed-nature-match-proposal";
import {
  withDeedMatchEvent,
} from "../../../components/case-study/case-study-report-state";
import {
  BOURSE_RESTRICTIONS_REQUIRED_MESSAGE,
  validatePropertyBourseFields,
} from "../../domain/po-intake/property-bourse-validation";
import { validatePropertyEnfathFields } from "../../domain/po-intake/property-deed-validation";
import { deedVitalityFromStatus } from "../../../views/my-task-work-state";

/** Fixes from the local A→Z run of 2026-11-02 (test-results/az-2026-11-02/findings.md). */

// #74/#75 (the «إضافة رفع مساحي» note in the inspector's section) — the note is gone (Omar 2026-11-11):
// the office is added from «مهمة جديدة», whatever the type; see create-engineering-survey-task.test.ts.

describe("#63 — a deed-match save reaches the report editor's copy", () => {
  it("takes the outcome and notes for the same task, case-insensitively", () => {
    const draft = emptyCaseStudyReportDraft("ABC");
    const next = withDeedMatchEvent(draft, {
      taskId: "abc",
      deedNatureMatchOutcome: "differences",
      deedNatureMatchNotes: "فرق في الحد الشمالي",
    });
    expect(next.deedNatureMatchOutcome).toBe("differences");
    expect(next.deedNatureMatchNotes).toBe("فرق في الحد الشمالي");
  });

  it("ignores another task's save", () => {
    const draft = emptyCaseStudyReportDraft("t1");
    expect(
      withDeedMatchEvent(draft, { taskId: "t2", deedNatureMatchOutcome: "matched", deedNatureMatchNotes: "" }),
    ).toBe(draft);
  });
});

describe("#20 — «مطابق» against the engineering office's «غير مطابق» needs a reason", () => {
  it("reads the office's submitted verdict into the proposal", () => {
    const base = {
      inspector: null,
      inspectorSubmitted: false,
      hasPriorSurvey: false,
      engineeringAssigned: true,
    };
    expect(proposeDeedNatureMatch({ ...base, engineeringDeedMatchesNature: "no" }).engineeringSaidNotMatched).toBe(
      true,
    );
    expect(proposeDeedNatureMatch({ ...base, engineeringDeedMatchesNature: "yes" }).engineeringSaidNotMatched).toBe(
      false,
    );
    expect(
      proposeDeedNatureMatch({ ...base, engineeringAssigned: false, engineeringDeedMatchesNature: "no" })
        .engineeringSaidNotMatched,
    ).toBe(false);
  });

  it("names whoever dissented and asks for 10 characters", () => {
    expect(deedMatchDissent(false, true)).toBe("office");
    expect(deedMatchDissent(true, true)).toBe("both");
    expect(deedMatchDissent(false, false)).toBeNull();
    expect(deedMatchDissentLabel("office")).toBe("المكتب الهندسي");
    expect(deedMatchOverrideReasonMessage("office")).toContain("المكتب الهندسي");
    expect(deedMatchOverrideReasonMissing("matched", "قصير", true)).toBe(true);
    expect(deedMatchOverrideReasonMissing("matched", "الحدود مطابقة للمخطط", true)).toBe(false);
  });
});

describe("#64 — «القيود» is required in the bourse", () => {
  const bourse = {
    ...emptyProperty(),
    id: "p1",
    deedNumber: "1234567890",
    city: "الرياض",
    district: "العليا",
    area: "500",
    bourseDeedImageFileName: "deed.pdf",
  };

  it("refuses an empty answer and accepts yes / no", () => {
    expect(validatePropertyBourseFields(bourse).restrictionsPresent).toBe(BOURSE_RESTRICTIONS_REQUIRED_MESSAGE);
    expect(validatePropertyBourseFields({ ...bourse, restrictionsPresent: "no" }).restrictionsPresent).toBeUndefined();
  });
});

describe("#67 — «حالة الصك» comes back from the autosaved deed status", () => {
  it("maps the stored status back to the pick", () => {
    expect(deedVitalityFromStatus("فعال")).toBe("active");
    expect(deedVitalityFromStatus(" غير فعال ")).toBe("inactive");
    expect(deedVitalityFromStatus("")).toBeNull();
    expect(deedVitalityFromStatus(undefined)).toBeNull();
  });
});

describe("#32 — the court path needs the court (the circuit is optional since 2026-11-10)", () => {
  it("returns a field error for the court only on «تنفيذ»", () => {
    const errors = validatePropertyEnfathFields({ ...emptyProperty(), court: "", circuit: "" }, "تنفيذ");
    expect(errors.court).toBeTruthy();
    expect(errors.circuit).toBeUndefined();
  });
});

describe("#12 — the study ring of a handed-over transaction", () => {
  const base = {
    property: { deedNumber: "123" },
    hasCaseStudyTask: true,
    caseStudyDone: true,
    hasInspection: true,
    inspectionDone: true,
    hasSurvey: false,
    surveyDone: false,
    hasAppraisal: true,
    appraisalDone: true,
    hasKeysHint: false,
  };

  it("is 100% once handed over to Enfaz", () => {
    const ring = estimateCaseStudyCompletion({ ...base, enfathDone: true });
    expect(ring.pct).toBe(100);
    expect(ring.done).toBe(ring.total);
  });

  it("leaves out stages that do not apply (no survey, no keys) instead of counting them 0", () => {
    const ring = estimateCaseStudyCompletion({ ...base, enfathDone: false });
    // primary, documents, inspection, valuation, case study, Enfaz → 5 of 6 done.
    expect(ring.total).toBe(6);
    expect(ring.done).toBe(5);
    expect(ring.pct).toBe(83);
  });
});
