import { describe, expect, it } from "vitest";
import {
  buildAssigneeOpenLoadMap,
  formatOpenPropertyLoadLabel,
  taskCountsTowardDistributionLoad,
  withOpenLoadLabel,
} from "../distribution-load";
import type { WorkflowTask } from "../tasks-storage";

function task(partial: Partial<WorkflowTask>): WorkflowTask {
  return {
    id: partial.id ?? "t1",
    kind: partial.kind ?? "case-study-property",
    poNumber: partial.poNumber ?? "PO-1",
    propertyOrdinal: partial.propertyOrdinal ?? 1,
    title: partial.title ?? "عقار",
    phase: partial.phase ?? "case-study",
    assigneeRole: partial.assigneeRole ?? "case-specialist",
    assigneeName: partial.assigneeName ?? "أسامة",
    assigneeId: partial.assigneeId,
    parentTaskId: partial.parentTaskId,
    status: partial.status ?? "open",
    createdAt: partial.createdAt ?? "2026-01-01T00:00:00Z",
    updatedAt: partial.updatedAt ?? "2026-01-01T00:00:00Z",
  };
}

describe("distribution-load", () => {
  it("counts open and blocked property work per assignee id", () => {
    const map = buildAssigneeOpenLoadMap([
      task({
        id: "1",
        assigneeId: "cs-osama",
        status: "open",
        kind: "case-study-property",
        phase: "case-study",
        assigneeRole: "case-specialist",
      }),
      task({
        id: "2",
        assigneeId: "cs-osama",
        status: "blocked",
        kind: "case-study-property",
        phase: "case-study",
        assigneeRole: "case-specialist",
      }),
      task({
        id: "3",
        assigneeId: "cs-osama",
        status: "completed",
        kind: "case-study-property",
        phase: "case-study",
        assigneeRole: "case-specialist",
      }),
      task({
        id: "4",
        assigneeId: "fi-ahmed",
        status: "open",
        kind: "field-inspection",
        assigneeRole: "field-inspector",
      }),
    ]);

    expect(map.get("cs-osama")).toBe(2);
    expect(map.get("fi-ahmed")).toBe(1);
  });

  it("does not count specialist tasks before case-study phase", () => {
    expect(
      taskCountsTowardDistributionLoad(
        task({
          kind: "case-study-property",
          phase: "enfath",
          assigneeRole: "case-specialist",
          status: "open",
        }),
      ),
    ).toBe(false);
  });

  it("formats Arabic load labels", () => {
    expect(formatOpenPropertyLoadLabel(0)).toBe("متاح — لا عبء حالياً");
    expect(formatOpenPropertyLoadLabel(1)).toBe("عقار واحد");
    expect(formatOpenPropertyLoadLabel(2)).toBe("عقاران");
    expect(formatOpenPropertyLoadLabel(5)).toBe("5 عقارات");
    expect(withOpenLoadLabel("أسامة — أخصائي", 3)).toBe(
      "أسامة — أخصائي · 3 عقارات",
    );
  });
});
