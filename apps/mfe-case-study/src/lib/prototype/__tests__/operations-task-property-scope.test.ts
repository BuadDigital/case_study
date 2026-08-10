import { describe, expect, it } from "vitest";
import {
  courtVisitTasksForProperty,
  filterOperationsTasksForProperty,
  primaryCourtVisitTask,
  courtVisitResultKindLabel,
} from "../operations-task-property-scope";
import type { OperationsTaskDto } from "@platform/api-client";

function task(overrides: Partial<OperationsTaskDto>): OperationsTaskDto {
  return {
    id: "t1",
    displayId: "OP-1",
    type: "court_visit",
    title: "زيارة",
    scope: "transaction",
    deeds: ["123"],
    poNumber: "PO-1",
    assigneeId: "a1",
    assigneeName: "مراجع",
    createdBy: "c1",
    createdByName: "منشئ",
    status: "completed",
    priority: "medium",
    dueAt: "2026-08-01T00:00:00Z",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-08-02T00:00:00Z",
    letterRows: [],
    comments: [],
    reminders: [],
    ...overrides,
  };
}

describe("operations-task-property-scope", () => {
  it("filters by po + deed for transaction scope", () => {
    const list = [
      task({ id: "a", deeds: ["123"], poNumber: "PO-1" }),
      task({ id: "b", deeds: ["999"], poNumber: "PO-1" }),
      task({ id: "c", type: "general", deeds: ["123"], poNumber: "PO-1" }),
    ];
    const forProp = filterOperationsTasksForProperty(list, {
      poNumber: "PO-1",
      deedNumber: "123",
    });
    expect(forProp.map((t) => t.id).sort()).toEqual(["a", "c"]);
    expect(courtVisitTasksForProperty(list, { poNumber: "PO-1", deedNumber: "123" }).map((t) => t.id)).toEqual([
      "a",
    ]);
  });

  it("prefers completed court visit with result", () => {
    const list = [
      task({
        id: "open",
        status: "in_progress",
        updatedAt: "2026-08-10T00:00:00Z",
      }),
      task({
        id: "done",
        status: "completed",
        updatedAt: "2026-08-05T00:00:00Z",
        courtVisitResult: { kind: "received" },
      }),
    ];
    const primary = primaryCourtVisitTask(list, {
      poNumber: "PO-1",
      deedNumber: "123",
    });
    expect(primary?.id).toBe("done");
  });

  it("labels court visit result kinds", () => {
    expect(courtVisitResultKindLabel("received")).toContain("ظرف");
    expect(courtVisitResultKindLabel("")).toBe("—");
  });
});
