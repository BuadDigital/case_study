import { describe, expect, it } from "vitest";
import {
  filterOpenAssignedTransactions,
  filterTasksAssignedToSpecialist,
} from "../assigned-transactions-filter";
import type { PoIntakeRecord } from "../po-intake-data";
import type { WorkflowTask } from "../tasks";

function task(
  over: Partial<WorkflowTask> & Pick<WorkflowTask, "id" | "poNumber">,
): WorkflowTask {
  return {
    kind: "case-study-property",
    propertyOrdinal: 1,
    title: "t",
    assigneeRole: "case-specialist",
    assigneeName: "أسامة الصالحي",
    phase: "enfath",
    status: "open",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function po(assignmentSpecialist: string): PoIntakeRecord {
  return { assignmentSpecialist } as PoIntakeRecord;
}

describe("filterTasksAssignedToSpecialist", () => {
  it("keeps only case-study rows named on the PO", () => {
    const poByNumber = new Map<string, PoIntakeRecord>([
      ["PO-MINE", po("أسامة الصالحي")],
      ["PO-OTHER", po("سالم")],
    ]);
    const listed = filterTasksAssignedToSpecialist(
      [
        task({ id: "mine", poNumber: "PO-MINE" }),
        task({ id: "other", poNumber: "PO-OTHER" }),
      ],
      poByNumber,
      "أسامة الصالحي",
    );
    expect(listed.map((t) => t.id)).toEqual(["mine"]);
  });
});

describe("filterOpenAssignedTransactions", () => {
  const poByNumber = new Map<string, PoIntakeRecord>([
    ["PO-MINE", po("أسامة الصالحي")],
    ["PO-OTHER", po("سالم")],
  ]);
  const tasks = [
    task({ id: "mine", poNumber: "PO-MINE" }),
    task({ id: "other", poNumber: "PO-OTHER" }),
  ];

  it("lets the case specialist see every transaction", () => {
    const listed = filterOpenAssignedTransactions(
      tasks,
      poByNumber,
      "case-specialist",
      "أسامة الصالحي",
    );
    expect(listed.map((t) => t.id)).toEqual(["mine", "other"]);
  });

  it("lets CDO see every transaction", () => {
    const listed = filterOpenAssignedTransactions(
      tasks,
      poByNumber,
      "cdo",
      "عماد",
    );
    expect(listed.map((t) => t.id)).toEqual(["mine", "other"]);
  });
});
