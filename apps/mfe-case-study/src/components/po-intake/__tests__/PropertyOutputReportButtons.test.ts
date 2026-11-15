import { describe, expect, it } from "vitest";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";
import { outputReportTasks, seesPropertyOutputReports } from "../PropertyOutputReportButtons";

function task(over: Partial<WorkflowTask>): WorkflowTask {
  return { status: "open", poNumber: "PO-1", propertyId: "p1", ...over } as WorkflowTask;
}

// Omar 2026-11-15: the header's two output reports, at any stage, never for the external parties.
describe("seesPropertyOutputReports", () => {
  it("hides the reports from the inspector, the engineering office and the government reviewer", () => {
    expect(seesPropertyOutputReports("field-inspector")).toBe(false);
    expect(seesPropertyOutputReports("engineering-office")).toBe(false);
    expect(seesPropertyOutputReports("government-reviewer")).toBe(false);
  });

  it("shows them to the staff and the appraiser", () => {
    expect(seesPropertyOutputReports("case-specialist")).toBe(true);
    expect(seesPropertyOutputReports("cdo")).toBe(true);
    expect(seesPropertyOutputReports("real-estate-appraiser")).toBe(true);
  });
});

describe("outputReportTasks", () => {
  const study = task({ id: "s1", kind: "case-study-property" });
  const appraisal = task({ id: "a1", kind: "property-appraisal", parentTaskId: "s1" });

  it("finds the deed's study and its appraisal child", () => {
    expect(outputReportTasks({ poNumber: "PO-1", propertyId: "p1", studyHolderTaskId: null, tasks: [study, appraisal] })).toEqual({
      studyTaskId: "s1",
      appraisalTask: appraisal,
    });
  });

  it("takes the holder deed's study on a linked property", () => {
    const holderAppraisal = task({ id: "a2", kind: "property-appraisal", parentTaskId: "h1", propertyId: "p2" });
    const found = outputReportTasks({
      poNumber: "PO-1",
      propertyId: "p1",
      studyHolderTaskId: " h1 ",
      tasks: [study, task({ id: "h1", kind: "case-study-property", propertyId: "p2" }), holderAppraisal],
    });
    expect(found).toEqual({ studyTaskId: "h1", appraisalTask: holderAppraisal });
  });

  it("reaches the study through the appraiser's own task when his list holds nothing else", () => {
    expect(outputReportTasks({ poNumber: "PO-1", propertyId: "p1", studyHolderTaskId: undefined, tasks: [appraisal] })).toEqual({
      studyTaskId: "s1",
      appraisalTask: appraisal,
    });
  });

  it("finds nothing before the study opens", () => {
    expect(outputReportTasks({ poNumber: "PO-1", propertyId: "p1", studyHolderTaskId: "", tasks: [] })).toEqual({
      studyTaskId: "",
      appraisalTask: null,
    });
  });
});
