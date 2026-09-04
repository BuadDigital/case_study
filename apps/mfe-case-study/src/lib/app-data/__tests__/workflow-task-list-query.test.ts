import { describe, expect, it } from "vitest";
import {
  csvFilterTokens,
  filterCachedWorkflowTasks,
  matchesWorkflowTaskFilters,
  type WorkflowTaskFilterRow,
} from "../workflow-task-list-query";

function row(over: Partial<WorkflowTaskFilterRow> = {}): WorkflowTaskFilterRow {
  return {
    kind: "case-study-property",
    status: "open",
    phase: "enfath",
    poNumber: "PO-2026-001",
    title: "دراسة حالة",
    assigneeName: "سالم",
    assigneeRole: "case-specialist",
    assigneeId: "assignee-1",
    assignmentType: "تنفيذ",
    ...over,
  };
}

describe("csvFilterTokens", () => {
  it("accepts both a CSV string and an array, dropping blanks", () => {
    expect(csvFilterTokens("open, blocked ,")).toEqual(["open", "blocked"]);
    expect(csvFilterTokens(["open", " ", "blocked"])).toEqual([
      "open",
      "blocked",
    ]);
    expect(csvFilterTokens(undefined)).toEqual([]);
  });
});

describe("matchesWorkflowTaskFilters", () => {
  it("keeps every row when there are no filters", () => {
    expect(matchesWorkflowTaskFilters(row())).toBe(true);
    expect(matchesWorkflowTaskFilters(row(), {})).toBe(true);
  });

  it("matches the CSV filters", () => {
    expect(
      matchesWorkflowTaskFilters(row(), { status: ["open", "blocked"] }),
    ).toBe(true);
    expect(matchesWorkflowTaskFilters(row(), { status: ["completed"] })).toBe(
      false,
    );
    expect(matchesWorkflowTaskFilters(row(), { phase: ["bourse"] })).toBe(false);
    expect(
      matchesWorkflowTaskFilters(row(), { kind: ["case-study-property"] }),
    ).toBe(true);
  });

  it("compares assigneeRole case-insensitively, like the endpoint", () => {
    expect(
      matchesWorkflowTaskFilters(row(), { assigneeRole: "CASE-Specialist" }),
    ).toBe(true);
    expect(
      matchesWorkflowTaskFilters(row(), { assigneeRole: "field-inspector" }),
    ).toBe(false);
  });

  it("matches the exact-value filters", () => {
    expect(matchesWorkflowTaskFilters(row(), { poNumber: "PO-2026-001" })).toBe(
      true,
    );
    expect(matchesWorkflowTaskFilters(row(), { poNumber: "PO-2026-002" })).toBe(
      false,
    );
    expect(matchesWorkflowTaskFilters(row(), { assigneeId: "assignee-1" })).toBe(
      true,
    );
    expect(matchesWorkflowTaskFilters(row(), { assignmentType: "تركات" })).toBe(
      false,
    );
  });

  it("searches the task's own columns", () => {
    expect(matchesWorkflowTaskFilters(row(), { q: "سالم" })).toBe(true);
    expect(matchesWorkflowTaskFilters(row(), { q: "PO-2026" })).toBe(true);
    expect(matchesWorkflowTaskFilters(row(), { q: "الرياض" })).toBe(false);
  });

  it("also searches the five PO-record columns the server joins on", () => {
    const withProperty = row({
      deedNumber: "310107029844",
      city: "الرياض",
      district: "النرجس",
      propertyType: "فيلا",
      classification: "سكني",
    });
    for (const q of ["029844", "الرياض", "النرجس", "فيلا", "سكني"]) {
      expect(matchesWorkflowTaskFilters(withProperty, { q })).toBe(true);
    }
    expect(matchesWorkflowTaskFilters(withProperty, { q: "جدة" })).toBe(false);
  });

  it("matches nothing on those columns for a task with no property", () => {
    expect(matchesWorkflowTaskFilters(row(), { q: "الرياض" })).toBe(false);
  });
});

describe("filterCachedWorkflowTasks", () => {
  it("returns the cache untouched when there is nothing to filter by", () => {
    const rows = [row(), row({ status: "completed" })];
    expect(filterCachedWorkflowTasks(rows)).toBe(rows);
  });

  it("applies the same predicate the endpoint would", () => {
    const rows = [
      row({ poNumber: "PO-1" }),
      row({ poNumber: "PO-2", status: "completed" }),
      row({ poNumber: "PO-3", phase: "bourse" }),
    ];
    expect(
      filterCachedWorkflowTasks(rows, {
        status: ["open", "blocked"],
        phase: ["enfath"],
      }).map((r) => r.poNumber),
    ).toEqual(["PO-1"]);
  });
});
