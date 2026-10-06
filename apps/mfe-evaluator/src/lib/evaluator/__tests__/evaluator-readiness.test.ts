import { afterEach, describe, expect, it } from "vitest";
import {
  clearReportDraftStates,
  putReportDraftStates,
} from "@platform/app-shared/workflow/report-draft-state";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";
import {
  isStudyReportBlockMessage,
  STUDY_REPORT_NOT_ISSUED_MESSAGE,
  studyReportGateForSubmission,
} from "../evaluator-inspection-gate";
import {
  appraiserInspectionDone,
  appraiserQueueStatusBadge,
  appraiserQueueStatusGroup,
  appraiserReadiness,
} from "../evaluator-readiness";

const baseAppraisal = (
  overrides: Partial<WorkflowTask> = {},
): WorkflowTask =>
  ({
    id: "a1",
    kind: "property-appraisal",
    poNumber: "PO-1",
    propertyId: "p1",
    parentTaskId: "parent",
    propertyOrdinal: 1,
    title: "تقييم",
    phase: "work",
    assigneeRole: "real-estate-appraiser",
    assigneeName: "مقيّم",
    status: "open",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }) as WorkflowTask;

const baseInspection = (
  overrides: Partial<WorkflowTask> = {},
): WorkflowTask =>
  ({
    id: "i1",
    kind: "field-inspection",
    poNumber: "PO-1",
    propertyId: "p1",
    parentTaskId: "parent",
    propertyOrdinal: 1,
    title: "معاينة",
    phase: "work",
    assigneeRole: "field-inspector",
    assigneeName: "معاين",
    status: "open",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }) as WorkflowTask;

describe("appraiser readiness — drafts from the start (no inspection gate)", () => {
  it("inspection completed, report issued: ready to submit", () => {
    const appraisal = baseAppraisal({
      fieldInspectionCompleted: true,
      fieldInspectionAccepted: false,
      studyReportIssued: true,
    });
    const tasks = [appraisal];

    expect(appraiserInspectionDone(appraisal, tasks)).toBe(true);
    expect(appraiserReadiness(appraisal, tasks)).toBe("ready");
  });

  it("a not-yet-inspected appraisal is just «قيد التقييم» — never a separate gated bucket", () => {
    for (const fieldInspectionCompleted of [false, undefined]) {
      const appraisal = baseAppraisal({ fieldInspectionCompleted });
      const tasks = [appraisal];
      expect(appraiserReadiness(appraisal, tasks)).toBe("drafting");
      expect(appraiserQueueStatusGroup(appraisal, tasks)).toBe("drafting");
      expect(appraiserQueueStatusBadge(appraisal, tasks).label).toBe(
        "قيد التقييم — بانتظار إصدار الدراسة",
      );
    }
  });

  it("completed sibling inspection is informational only", () => {
    const appraisal = baseAppraisal({ studyReportIssued: true });
    const inspection = baseInspection({ status: "completed" });
    const tasks = [appraisal, inspection];

    expect(appraiserInspectionDone(appraisal, tasks)).toBe(true);
    expect(appraiserReadiness(appraisal, tasks)).toBe("ready");
  });

  it("survey pending does not change readiness", () => {
    const appraisal = baseAppraisal({
      fieldInspectionCompleted: true,
      studyReportIssued: true,
    });
    const survey = {
      ...baseInspection({
        id: "s1",
        kind: "engineering-survey" as const,
        assigneeRole: "engineering-office",
        status: "open",
      }),
    } as WorkflowTask;
    const tasks = [appraisal, survey];

    expect(appraiserReadiness(appraisal, tasks)).toBe("ready");
  });
});

describe("appraiser readiness — study report wait state", () => {
  it("report not issued: drafting, whatever the inspection state", () => {
    for (const fieldInspectionCompleted of [true, false]) {
      for (const studyReportIssued of [false, undefined]) {
        const appraisal = baseAppraisal({ fieldInspectionCompleted, studyReportIssued });
        const tasks = [appraisal];
        expect(appraiserReadiness(appraisal, tasks)).toBe("drafting");
        expect(appraiserQueueStatusGroup(appraisal, tasks)).toBe("drafting");
      }
    }
  });

  it("an issued report turns the same task ready", () => {
    const appraisal = baseAppraisal({
      fieldInspectionCompleted: false,
      studyReportIssued: true,
    });
    expect(appraiserQueueStatusGroup(appraisal, [appraisal])).toBe("ready");
    expect(appraiserQueueStatusBadge(appraisal, [appraisal]).label).toBe(
      "جاهزة للتسليم",
    );
  });

  it("completed and obstructed tasks keep their own buckets", () => {
    const done = baseAppraisal({ status: "completed" });
    expect(appraiserQueueStatusGroup(done, [done])).toBe("closed");
    expect(appraiserQueueStatusBadge(done, [done]).label).toBe("صدر التقرير النهائي");
  });
});

describe("appraiser queue — after hand-over, the report draft decides the label", () => {
  afterEach(() => clearReportDraftStates());

  const handedOver = () => baseAppraisal({ appraisalPackageStatus: "submitted" });

  it("handed over, no draft yet: waiting for the specialist's draft", () => {
    const task = handedOver();
    expect(appraiserQueueStatusGroup(task, [task])).toBe("submitted");
    expect(appraiserQueueStatusBadge(task, [task]).label).toBe("مُسلَّمة — بانتظار مسودة التقرير");
  });

  it("a sent draft waits for the appraiser", () => {
    putReportDraftStates([{ propertyId: "p1", status: "sent", reportStage: "draft" }]);
    const task = handedOver();
    expect(appraiserQueueStatusGroup(task, [task])).toBe("draft_sent");
    expect(appraiserQueueStatusBadge(task, [task]).label).toBe("مسودة بانتظار اعتمادك");
  });

  it("an approved report waits for the deposit code", () => {
    putReportDraftStates([{ propertyId: "p1", status: "approved", reportStage: "deposit_issued" }]);
    const task = handedOver();
    expect(appraiserQueueStatusGroup(task, [task])).toBe("approved");
    expect(appraiserQueueStatusBadge(task, [task]).label).toBe("معتمد — بانتظار رمز الإيداع");
  });

  it("a draft state of another property changes nothing", () => {
    putReportDraftStates([{ propertyId: "other", status: "sent", reportStage: "draft" }]);
    const task = handedOver();
    expect(appraiserQueueStatusGroup(task, [task])).toBe("submitted");
  });
});

describe("studyReportGateForSubmission", () => {
  it("is ready only for an explicit true", () => {
    expect(studyReportGateForSubmission({ studyReportIssued: true })).toEqual({
      ready: true,
    });
  });

  it("closes for false, null, missing flag and a missing source", () => {
    const closed = { ready: false, reason: STUDY_REPORT_NOT_ISSUED_MESSAGE };
    expect(studyReportGateForSubmission({ studyReportIssued: false })).toEqual(closed);
    expect(studyReportGateForSubmission({ studyReportIssued: null })).toEqual(closed);
    expect(studyReportGateForSubmission({})).toEqual(closed);
    expect(studyReportGateForSubmission(null)).toEqual(closed);
    expect(studyReportGateForSubmission(undefined)).toEqual(closed);
  });

  it("accepts a task or a party submission shape and uses the agreed reason", () => {
    expect(STUDY_REPORT_NOT_ISSUED_MESSAGE).toBe(
      "لا يمكن تسليم التقييم قبل أن يصدر الأخصائي تقرير دراسة الحالة",
    );
    expect(isStudyReportBlockMessage(STUDY_REPORT_NOT_ISSUED_MESSAGE)).toBe(true);
    expect(isStudyReportBlockMessage("تعذّر إرسال التقييم")).toBe(false);
    expect(isStudyReportBlockMessage(null)).toBe(false);
  });
});
