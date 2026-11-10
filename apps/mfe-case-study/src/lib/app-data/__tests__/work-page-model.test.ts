import { describe, expect, it } from "vitest";
import type { WorkflowTask } from "../tasks";
import { workSectionStatus } from "@platform/ui-kit";
import { WORK_SECTIONS, reviewLockOf, workPageStep } from "../work-page-model";

function task(over: Partial<WorkflowTask>): WorkflowTask {
  return {
    id: "cs",
    kind: "case-study-property",
    poNumber: "PO-1",
    propertyId: "p1",
    propertyOrdinal: 1,
    title: "",
    phase: "enfath",
    assigneeRole: "case-specialist",
    assigneeName: "",
    status: "open",
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    ...over,
  } as WorkflowTask;
}
const none = () => undefined;
const appraisal = (status: WorkflowTask["status"]) =>
  task({ id: "apr", kind: "property-appraisal", status, appraisalPackageStatus: "submitted" });

describe("workPageStep", () => {
  it("follows the transaction from intake to the upload", () => {
    expect(workPageStep(task({ phase: "enfath" }), [], none)).toBe(0);
    expect(workPageStep(task({ phase: "bourse" }), [], none)).toBe(1);
    expect(workPageStep(task({ phase: "obstruction", obstructionPriorPhase: "distribution" }), [], none)).toBe(2);
    expect(workPageStep(task({ phase: "case-study" }), [], none)).toBe(3);
    expect(workPageStep(task({ phase: "case-study", transactionReceived: true }), [], none)).toBe(4);
    const issued = task({ phase: "done", status: "completed", studyReportIssued: true });
    expect(workPageStep(issued, [appraisal("open")], none)).toBe(5);
    expect(workPageStep(issued, [appraisal("completed")], none)).toBe(6);
    expect(workPageStep(task({ ...issued, propertyHandedOverToEnfaz: true }), [], none)).toBe(7);
  });

  it("marks sections done / current / todo against the step", () => {
    const byId = Object.fromEntries(WORK_SECTIONS.map((s) => [s.id, workSectionStatus(s, 4)]));
    expect(byId).toEqual({
      intake: "done",
      bourse: "done",
      distribution: "done",
      inspector: "done",
      survey: "done",
      external: "done",
      linked: "done",
      inspection: "current",
      study: "current",
      photos: "current",
      valuation: "todo",
      upload: "todo",
    });
  });
});

describe("reviewLockOf (Omar 2026-11-08)", () => {
  it("locks for everyone once review approves the study, and everything once the appraiser approves", () => {
    expect(reviewLockOf(undefined, undefined)).toBeNull();
    expect(reviewLockOf({ reviewState: "handed" }, { status: "preparing", reportStage: "draft" })).toBeNull();
    expect(reviewLockOf({ reviewState: "approved" }, undefined)).toBe("study-approved");
    expect(reviewLockOf({ reviewState: "approved" }, { status: "sent", reportStage: "draft" })).toBe("study-approved");
    expect(reviewLockOf({ reviewState: "approved" }, { status: "approved", reportStage: "draft" })).toBe("report-approved");
    expect(reviewLockOf({ reviewState: "study" }, { status: "preparing", reportStage: "final_issued" })).toBe("report-approved");
  });
});
