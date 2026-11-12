import { describe, expect, it } from "vitest";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import {
  addedSurveysOfProperty,
  surveysAddedAfterDistribution,
  visibleAddedSurveys,
} from "../operations-tasks-added-surveys";

/**
 * Omar 2026-11-11: the engineering office added from «مهمة جديدة» shows on the tasks page — it is the
 * office's survey task, not an operations task. Since 2026-11-12 it is a row of the tasks table.
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

describe("visibleAddedSurveys — the survey rows under the table's filters (Omar 2026-11-12)", () => {
  const rows = surveysAddedAfterDistribution([
    ...transaction("a"),
    survey("a", { deedNumber: "111222", poNumber: "PO-036999", assigneeName: "مكتب جدة للمساحة" }),
    ...transaction("b"),
    survey("b", { deedNumber: "777", poNumber: "PO-5", assigneeName: "مكتب الرياض" }),
  ]);
  const all = { search: "", statusFilter: "", scopeFilter: "" };

  it("keeps every row with no filter, and under the one-deed scope", () => {
    expect(visibleAddedSurveys(rows, all)).toHaveLength(2);
    expect(visibleAddedSurveys(rows, { ...all, scopeFilter: "transaction" })).toHaveLength(2);
  });

  it("matches the search on the deed, the work order or the office", () => {
    const found = (search: string) => visibleAddedSurveys(rows, { ...all, search }).map((r) => r.task.deedNumber);
    expect(found("1112")).toEqual(["111222"]);
    expect(found("po-5")).toEqual(["777"]);
    expect(found("  جدة ")).toEqual(["111222"]);
    expect(found("لا شيء")).toEqual([]);
  });

  it("leaves them out of a status filter and of the other scopes", () => {
    expect(visibleAddedSurveys(rows, { ...all, statusFilter: "in_progress" })).toEqual([]);
    expect(visibleAddedSurveys(rows, { ...all, scopeFilter: "work_order" })).toEqual([]);
  });
});

describe("addedSurveysOfProperty — the deed's own «المهام المرتبطة» (Omar 2026-11-12)", () => {
  const tasks = [
    ...transaction("a"),
    survey("a", { propertyId: "deed-a" }),
    ...transaction("b"),
    survey("b", { propertyId: "deed-b" }),
  ];

  it("keeps the survey of that deed only", () => {
    expect(addedSurveysOfProperty(tasks, "deed-a").map((r) => r.task.id)).toEqual(["a-s"]);
    expect(addedSurveysOfProperty(tasks, "deed-c")).toEqual([]);
  });

  it("lists none for a survey the distribution itself spawned", () => {
    const spawned = [...transaction("a"), survey("a", { propertyId: "deed-a", createdAt: DISTRIBUTED })];
    expect(addedSurveysOfProperty(spawned, "deed-a")).toEqual([]);
  });
});
