import { describe, expect, it } from "vitest";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import { surveysAddedAfterDistribution } from "../operations-tasks-added-surveys";

/**
 * Omar 2026-11-11: the engineering office added from «مهمة جديدة» shows on the tasks page, in its own
 * block above the table — it is the office's survey task, not an operations task.
 */

const DISTRIBUTED = "2026-09-28T10:38:26Z";
const ADDED = "2026-11-11T12:25:45Z";

function task(over: Partial<WorkflowTask>): WorkflowTask {
  return { status: "open", createdAt: DISTRIBUTED, ...over } as WorkflowTask;
}

function transaction(id: string, phase: WorkflowTask["phase"] = "case-study"): WorkflowTask[] {
  return [
    task({ id, kind: "case-study-property", phase }),
    task({ id: `${id}-i`, kind: "field-inspection", parentTaskId: id }),
  ];
}

function survey(parent: string, over: Partial<WorkflowTask> = {}): WorkflowTask {
  return task({ id: `${parent}-s`, kind: "engineering-survey", parentTaskId: parent, createdAt: ADDED, ...over });
}

describe("surveysAddedAfterDistribution", () => {
  it("lists the survey added later, and not the one the distribution spawned", () => {
    const rows = surveysAddedAfterDistribution([
      ...transaction("a"),
      survey("a"),
      ...transaction("b"),
      survey("b", { createdAt: DISTRIBUTED }),
    ]);
    expect(rows.map((r) => [r.task.id, r.state])).toEqual([["a-s", "open"]]);
  });

  it("says where the survey stands: with the office, delivered, received", () => {
    const state = (over: Partial<WorkflowTask>) =>
      surveysAddedAfterDistribution([...transaction("a"), survey("a", over)])[0]?.state;
    expect(state({})).toBe("open");
    expect(state({ status: "completed" })).toBe("delivered");
    expect(state({ status: "completed", packageAccepted: true })).toBe("received");
  });

  it("drops a skipped office and a transaction that left the study phase", () => {
    expect(surveysAddedAfterDistribution([...transaction("a"), survey("a", { status: "cancelled" })])).toEqual([]);
    expect(surveysAddedAfterDistribution([...transaction("a", "done"), survey("a")])).toEqual([]);
  });

  it("leaves out a survey it cannot tell apart, and shows the newest first", () => {
    expect(surveysAddedAfterDistribution([task({ id: "a", kind: "case-study-property", phase: "case-study" }), survey("a")])).toEqual([]);
    const rows = surveysAddedAfterDistribution([
      ...transaction("a"),
      survey("a", { createdAt: "2026-11-01T08:00:00Z" }),
      ...transaction("b"),
      survey("b"),
    ]);
    expect(rows.map((r) => r.task.id)).toEqual(["b-s", "a-s"]);
  });
});
