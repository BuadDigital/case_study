import { describe, expect, it } from "vitest";
import {
  collapseAllTransactionsToLatestPhase,
  formatAllTransactionsDeedWithPhase,
  type AllTransactionsQueueRowMeta,
} from "../all-transactions-queue";
import type { WorkflowTask } from "../tasks-storage";

function task(
  partial: Partial<WorkflowTask> &
    Pick<WorkflowTask, "id" | "kind" | "phase" | "status">,
): WorkflowTask {
  return {
    poNumber: "PO-1",
    propertyOrdinal: 1,
    title: "t",
    assigneeRole: "case-specialist",
    assigneeName: "x",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    propertyId: "prop-1",
    ...partial,
  };
}

function row(
  t: WorkflowTask,
  phaseLabel: string,
  overrides?: Partial<AllTransactionsQueueRowMeta>,
): AllTransactionsQueueRowMeta {
  return {
    task: t,
    deed: "12345",
    deedCell: formatAllTransactionsDeedWithPhase("12345", phaseLabel),
    poNumber: "PO-1",
    assignmentType: "عادي",
    city: "الرياض",
    district: "—",
    phaseLabel,
    propertyId: "prop-1",
    ...overrides,
  };
}

describe("formatAllTransactionsDeedWithPhase", () => {
  it("puts the phase in parentheses next to the deed", () => {
    expect(formatAllTransactionsDeedWithPhase("12345", "دراسة الحالة")).toBe(
      "صك 12345 (دراسة الحالة)",
    );
  });
});

describe("collapseAllTransactionsToLatestPhase", () => {
  it("keeps one row per property at the furthest stage", () => {
    const collapsed = collapseAllTransactionsToLatestPhase([
      row(
        task({
          id: "1",
          kind: "case-study-property",
          phase: "enfath",
          status: "completed",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }),
        "مكتمل",
      ),
      row(
        task({
          id: "2",
          kind: "case-study-property",
          phase: "distribution",
          status: "open",
          updatedAt: "2026-01-02T00:00:00.000Z",
        }),
        "التوزيع",
      ),
      row(
        task({
          id: "3",
          kind: "field-inspection",
          phase: "case-study",
          status: "open",
          updatedAt: "2026-01-03T00:00:00.000Z",
        }),
        "معاينة العقار",
      ),
    ]);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]!.task.id).toBe("3");
    expect(collapsed[0]!.phaseLabel).toBe("معاينة العقار");
    expect(collapsed[0]!.deedCell).toBe("صك 12345 (معاينة العقار)");
  });

  it("labels fully completed property groups as مكتمل", () => {
    const collapsed = collapseAllTransactionsToLatestPhase([
      row(
        task({
          id: "a",
          kind: "case-study-property",
          phase: "done",
          status: "completed",
        }),
        "مكتمل",
      ),
      row(
        task({
          id: "b",
          kind: "field-inspection",
          phase: "done",
          status: "completed",
        }),
        "مكتمل",
      ),
    ]);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]!.phaseLabel).toBe("مكتمل");
    expect(collapsed[0]!.deedCell).toBe("صك 12345 (مكتمل)");
  });

  it("does not collapse different properties", () => {
    const collapsed = collapseAllTransactionsToLatestPhase([
      row(
        task({
          id: "1",
          kind: "case-study-property",
          phase: "enfath",
          status: "open",
          propertyId: "p1",
        }),
        "البيانات الأولية",
        { propertyId: "p1", deed: "111" },
      ),
      row(
        task({
          id: "2",
          kind: "case-study-property",
          phase: "bourse",
          status: "open",
          propertyId: "p2",
        }),
        "البورصة",
        { propertyId: "p2", deed: "222" },
      ),
    ]);

    expect(collapsed).toHaveLength(2);
  });
});
