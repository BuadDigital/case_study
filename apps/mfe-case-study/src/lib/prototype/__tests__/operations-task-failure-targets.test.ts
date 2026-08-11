import { describe, expect, it } from "vitest";
import { failureTargetsForOperationsTask } from "../operations-task-failure-targets";
import type { OperationsTask } from "../operations-tasks-storage";
import type { PoIntakeRecord } from "../po-intake-data";

function minimalTask(
  patch: Partial<OperationsTask> & Pick<OperationsTask, "id">,
): OperationsTask {
  return {
    id: patch.id,
    displayId: "OT-1",
    type: "court_visit",
    title: "زيارة",
    scope: "work_order",
    deeds: patch.deeds ?? [],
    poNumber: patch.poNumber,
    assigneeId: "a1",
    assigneeName: "مراجع",
    createdBy: "c1",
    createdByName: "منشئ",
    status: "in_progress",
    priority: "medium",
    dueAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    letterRows: patch.letterRows ?? [],
    comments: [],
    reminders: [],
    ...patch,
  };
}

function minimalPo(poNumber: string, propertyId: string, deed: string): PoIntakeRecord {
  return {
    poNumber,
    properties: [
      {
        id: propertyId,
        deedNumber: deed,
        realEstateRegNumber: "",
        identifierType: "deed",
        isRemoved: false,
      } as PoIntakeRecord["properties"][number],
    ],
  } as PoIntakeRecord;
}

describe("failureTargetsForOperationsTask", () => {
  it("resolves property from letter rows", () => {
    const task = minimalTask({
      id: "t1",
      letterRows: [
        {
          po: "PO-9",
          deed: "123",
          owner: "x",
          request: "r",
          court: "c",
          circuit: "d",
        },
      ],
    });
    const targets = failureTargetsForOperationsTask(task, [
      minimalPo("PO-9", "prop-1", "123"),
    ]);
    expect(targets).toEqual([
      { poNumber: "PO-9", propertyId: "prop-1", deedNumber: "123" },
    ]);
  });

  it("resolves from task po + deeds when letterRows empty", () => {
    const task = minimalTask({
      id: "t2",
      poNumber: "PO-2",
      deeds: ["555"],
      letterRows: [],
    });
    const targets = failureTargetsForOperationsTask(task, [
      minimalPo("PO-2", "p2", "555"),
    ]);
    expect(targets).toHaveLength(1);
    expect(targets[0]?.propertyId).toBe("p2");
  });

  it("returns empty when PO/deed not in intake", () => {
    const task = minimalTask({
      id: "t3",
      letterRows: [
        {
          po: "PO-x",
          deed: "999",
          owner: "",
          request: "",
          court: "",
          circuit: "",
        },
      ],
    });
    expect(failureTargetsForOperationsTask(task, [])).toEqual([]);
  });
});
