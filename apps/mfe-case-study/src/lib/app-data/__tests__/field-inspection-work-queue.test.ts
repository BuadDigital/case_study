import { describe, expect, it } from "vitest";
import {
  filterFieldInspectionListedTasks,
  isVisibleInFieldInspectionQueue,
} from "../field-inspection-work-queue";
import type { WorkflowTask } from "../tasks-storage";

function task(
  over: Partial<WorkflowTask> & Pick<WorkflowTask, "id" | "status">,
): WorkflowTask {
  return {
    kind: "field-inspection",
    poNumber: "PO-1",
    propertyOrdinal: 1,
    phase: "inspection",
    ...over,
  } as WorkflowTask;
}

describe("isVisibleInFieldInspectionQueue", () => {
  it("hides completed rows until «إظهار المكتملة» is on", () => {
    expect(isVisibleInFieldInspectionQueue("open")).toBe(true);
    expect(isVisibleInFieldInspectionQueue("blocked")).toBe(true);
    expect(isVisibleInFieldInspectionQueue("completed")).toBe(false);
    expect(
      isVisibleInFieldInspectionQueue("completed", { showCompleted: true }),
    ).toBe(true);
  });

  it("hides a submitted workspace while the task is still open", () => {
    expect(
      isVisibleInFieldInspectionQueue("open", {
        workspaceStatus: "submitted",
      }),
    ).toBe(false);
    expect(
      isVisibleInFieldInspectionQueue("open", {
        workspaceStatus: "submitted",
        showCompleted: true,
      }),
    ).toBe(true);
  });
});

describe("filterFieldInspectionListedTasks", () => {
  it("keeps only field-inspection rows and respects the toggle", () => {
    const rows = [
      task({ id: "a", status: "open" }),
      task({ id: "b", status: "completed" }),
      task({ id: "c", status: "open", kind: "engineering-survey" as never }),
    ];
    expect(filterFieldInspectionListedTasks(rows).map((t) => t.id)).toEqual([
      "a",
    ]);
    expect(
      filterFieldInspectionListedTasks(rows, { showCompleted: true }).map(
        (t) => t.id,
      ),
    ).toEqual(["a", "b"]);
  });
});
