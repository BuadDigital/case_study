import { describe, expect, it, vi } from "vitest";
import type { WorkflowTask } from "../tasks";

vi.mock("../../evaluator-bridge", () => ({
  appraiserQueueStatusGroup: (task: { id: string }) =>
    (
      {
        t_ready: "ready",
        t_draft: "drafting",
        t_draft2: "drafting",
        t_draft3: "drafting",
      } as Record<string, string>
    )[task.id] ?? "drafting",
  filterAppraiserListedTasks: (tasks: unknown[]) => tasks,
  loadEvaluatorSubmission: () => null,
}));

import {
  PAGE_SITUATION_CARDS,
  computePageSituationValues,
} from "../active-transaction-page-situation";

const appraisal = (id: string) =>
  ({
    id,
    kind: "property-appraisal",
    poNumber: "PO-1",
    propertyOrdinal: 1,
    status: "open",
    assigneeRole: "real-estate-appraiser",
  }) as WorkflowTask;

describe("appraisal page situation — drafting from the start", () => {
  it("has «قيد التقييم» and «جاهزة للتسليم» cards and no start-gate cards", () => {
    const cards = PAGE_SITUATION_CARDS["property-appraisal"] ?? [];
    expect(cards.find((c) => c.key === "drafting")?.label).toBe("قيد التقييم");
    expect(cards.find((c) => c.key === "ready")?.label).toBe("جاهزة للتسليم");
    expect(cards.some((c) => c.key === "gated" || c.key === "waitingStudy")).toBe(false);
  });

  it("counts every not-yet-issued appraisal as drafting, apart from ready", () => {
    const tasks = ["t_ready", "t_draft", "t_draft2", "t_draft3"].map(appraisal);
    const values = computePageSituationValues("property-appraisal", {
      tasks,
      allTasks: tasks,
      poByNumber: new Map(),
    });
    expect(values).toMatchObject({
      ready: 1,
      drafting: 3,
      submitted: 0,
      reopened: 0,
    });
  });
});
