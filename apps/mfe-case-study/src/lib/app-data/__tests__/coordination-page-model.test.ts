import { describe, expect, it } from "vitest";
import type { WorkflowTask } from "../tasks";
import {
  COORDINATION_DONE_STEP,
  COORDINATION_SECTIONS,
  FOLLOW_UP_STEP,
  coordinationStep,
} from "../coordination-page-model";
import { workSectionStatus } from "@platform/ui-kit";

function task(over: Partial<WorkflowTask>): WorkflowTask {
  return {
    id: "t",
    kind: "case-study-property",
    poNumber: "PO-1",
    propertyId: "p1",
    propertyOrdinal: 1,
    title: "",
    phase: "enfath",
    assigneeRole: "case-specialist",
    assigneeName: "",
    status: "open",
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    ...over,
  } as WorkflowTask;
}

// Omar 2026-11-08: the coordinator's own page — intake, then the parties' follow-up, then the send.
describe("coordinationStep", () => {
  it("walks the intake by phase, then the follow-up until the transaction is sent", () => {
    expect(coordinationStep(null)).toBe(0);
    expect(coordinationStep(task({ phase: "enfath" }))).toBe(0);
    expect(coordinationStep(task({ phase: "bourse" }))).toBe(1);
    expect(coordinationStep(task({ phase: "distribution" }))).toBe(2);
    expect(coordinationStep(task({ phase: "obstruction", obstructionPriorPhase: "bourse" }))).toBe(1);
    expect(coordinationStep(task({ phase: "case-study" }))).toBe(FOLLOW_UP_STEP);
    expect(coordinationStep(task({ phase: "case-study", transactionReceived: true }))).toBe(COORDINATION_DONE_STEP);
    expect(coordinationStep(task({ phase: "done", status: "completed" }))).toBe(COORDINATION_DONE_STEP);
    expect(coordinationStep(task({ status: "cancelled" }))).toBe(COORDINATION_DONE_STEP);
  });

  it("works every party section together in the follow-up", () => {
    const statuses = Object.fromEntries(
      COORDINATION_SECTIONS.map((s) => [s.id, workSectionStatus(s, FOLLOW_UP_STEP)]),
    );
    expect(statuses).toEqual({
      intake: "done",
      bourse: "done",
      distribution: "done",
      inspector: "current",
      survey: "current",
      external: "current",
      linked: "current",
    });
  });
});
