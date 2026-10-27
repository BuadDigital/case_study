import { describe, expect, it } from "vitest";
import type { WorkflowTask } from "../../workflow/task-types";
import { filterTasksForSystemUpload } from "../active-transactions";

function task(over: Partial<WorkflowTask>): WorkflowTask {
  return {
    id: "t",
    kind: "case-study-property",
    poNumber: "PO-1",
    propertyId: "p1",
    propertyOrdinal: 1,
    title: "",
    phase: "done",
    assigneeRole: "case-specialist",
    assigneeName: "",
    status: "completed",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    ...over,
  } as WorkflowTask;
}

const study = task({ id: "study" });
const appraisal = (status: WorkflowTask["status"], propertyId = "p1") =>
  task({
    id: `appraisal-${propertyId}-${status}`,
    kind: "property-appraisal",
    assigneeRole: "real-estate-appraiser",
    propertyId,
    status,
  });

describe("filterTasksForSystemUpload", () => {
  it("lists an issued study only once the valuation is deposited", () => {
    expect(filterTasksForSystemUpload([study], [study, appraisal("completed")])).toEqual([study]);
    expect(filterTasksForSystemUpload([study], [study, appraisal("open")])).toEqual([]);
    expect(filterTasksForSystemUpload([study], [study])).toEqual([]);
  });

  it("ignores a cancelled appraisal and an open study", () => {
    expect(filterTasksForSystemUpload([study], [study, appraisal("cancelled")])).toEqual([]);
    const openStudy = task({ id: "open", status: "open", phase: "case-study" });
    expect(filterTasksForSystemUpload([openStudy], [openStudy, appraisal("completed")])).toEqual([]);
  });

  it("reads the appraisal from the full list, not the viewer's own tasks", () => {
    expect(filterTasksForSystemUpload([study])).toEqual([]);
    expect(filterTasksForSystemUpload([study], [appraisal("completed")])).toEqual([study]);
  });

  it("a folded deed follows the holder deed's valuation", () => {
    const folded = task({ id: "folded", propertyId: "p2", transactionStudyHolderPropertyId: "p1" });
    expect(
      filterTasksForSystemUpload([folded], [appraisal("completed", "p1"), appraisal("open", "p2")]),
    ).toEqual([folded]);
    expect(
      filterTasksForSystemUpload([folded], [appraisal("open", "p1"), appraisal("completed", "p2")]),
    ).toEqual([]);
  });
});
