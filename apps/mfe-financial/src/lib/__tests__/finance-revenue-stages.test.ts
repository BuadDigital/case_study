import { describe, expect, it } from "vitest";
import type { EnfazTrackingRowDto } from "@platform/api-client";
import { buildFinanceMyTasks } from "../finance-my-tasks";
import { resolveRevenueStage } from "../finance-revenue-stages";

function row(over: Partial<EnfazTrackingRowDto> = {}): EnfazTrackingRowDto {
  return {
    poNumber: "PO-1",
    workOrderId: "wo-1",
    propertyId: "p-1",
    propertyLabel: "عقار",
    billingReadyAtUtc: null,
    deedNumber: "D-1",
    city: "جدة",
    landArea: "500",
    completedAtUtc: new Date().toISOString(),
    workStatus: "done",
    workStatusLabel: "مكتملة",
    enfazFilled: false,
    caseStudyFeeSar: 0,
    surveyFeeSar: 0,
    keyFeeSar: 0,
    enfazFeeSar: 0,
    invoiceNumber: null,
    invoiceStatus: null,
    collectedAmountSar: 0,
    invoiceIssuedAtUtc: null,
    isOverdue: false,
    financeFlag: null,
    financeFlagNote: null,
    followupCount: 0,
    ...over,
  };
}

const MARKED = "2026-10-20T08:00:00Z";

describe("resolveRevenueStage — the accountant's «جاهز للفوترة» mark", () => {
  it("keeps a handed-over deed in «مؤهلة» until it is marked, whatever fees were typed", () => {
    expect(resolveRevenueStage(row())).toBe("eligible");
    expect(
      resolveRevenueStage(row({ enfazFilled: true, enfazFeeSar: 900 })),
    ).toBe("eligible");
  });

  it("moves a marked deed to the billing assistant once its fees are matched", () => {
    expect(
      resolveRevenueStage(row({ billingReadyAtUtc: MARKED, enfazFilled: true, enfazFeeSar: 900 })),
    ).toBe("billing_assistant");
    expect(resolveRevenueStage(row({ billingReadyAtUtc: MARKED }))).toBe("eligible");
  });

  it("does not move a deed under study or an open invoice because of the mark", () => {
    expect(resolveRevenueStage(row({ workStatus: "in_progress" }))).toBe("under_study");
    expect(
      resolveRevenueStage(row({ invoiceNumber: "INV-1", invoiceStatus: "issued" })),
    ).toBe("awaiting_collection");
    expect(
      resolveRevenueStage(row({ invoiceNumber: "INV-1", invoiceStatus: "collected" })),
    ).toBe("collected");
  });
});

describe("buildFinanceMyTasks — marking comes before matching", () => {
  const tasks = buildFinanceMyTasks({
    tracking: [
      row({ propertyId: "a" }),
      row({ propertyId: "b", poNumber: "PO-2", billingReadyAtUtc: MARKED }),
    ],
    readyLines: [],
    statements: [],
  });

  it("asks the accountant to mark an unmarked deed", () => {
    const mark = tasks.find((t) => t.id === "rev-eligible_mark-PO-1");
    expect(mark?.title).toBe("تعليم جاهز للفوترة");
    expect(mark?.movesTo).toBe("مطابقة الأتعاب");
  });

  it("asks for the fee match only once the deed is marked", () => {
    expect(tasks.find((t) => t.id === "rev-eligible-PO-2")?.title).toBe("مطابقة الأتعاب");
    expect(tasks.find((t) => t.id === "rev-eligible-PO-1")).toBeUndefined();
    expect(tasks.find((t) => t.id === "rev-eligible_mark-PO-2")).toBeUndefined();
  });
});
