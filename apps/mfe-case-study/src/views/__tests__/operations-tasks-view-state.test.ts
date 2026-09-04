import { describe, expect, it } from "vitest";
import {
  INITIAL_OPERATIONS_TASK_QUERY,
  operationsTaskQueryReducer,
  toOperationsTaskListQuery,
  visibleOperationsTasks,
  type OperationsTaskQueryState,
} from "../operations-tasks-view-state";
import type { OperationsTask } from "../../lib/app-data/operations-tasks-model";

describe("operationsTaskQueryReducer", () => {
  it("stores each filter and keeps identity when the value is unchanged", () => {
    const state = INITIAL_OPERATIONS_TASK_QUERY;
    expect(
      operationsTaskQueryReducer(state, { type: "search", value: "PO-1" })
        .search,
    ).toBe("PO-1");
    expect(
      operationsTaskQueryReducer(state, { type: "status", value: "paused" })
        .statusFilter,
    ).toBe("paused");
    expect(
      operationsTaskQueryReducer(state, { type: "scope", value: "work_order" })
        .scopeFilter,
    ).toBe("work_order");
    expect(
      operationsTaskQueryReducer(state, {
        type: "taskType",
        value: "court_visit",
      }).typeFilter,
    ).toBe("court_visit");
    expect(
      operationsTaskQueryReducer(state, { type: "showAll", value: true })
        .showAll,
    ).toBe(true);

    expect(operationsTaskQueryReducer(state, { type: "search", value: "" })).toBe(
      state,
    );
    expect(
      operationsTaskQueryReducer(state, { type: "showAll", value: false }),
    ).toBe(state);
  });
});

describe("toOperationsTaskListQuery", () => {
  const base: OperationsTaskQueryState = INITIAL_OPERATIONS_TASK_QUERY;

  it("asks for the active rows only while the 'show all' toggle is off", () => {
    expect(
      toOperationsTaskListQuery(base, { excludeFailurePaused: false }),
    ).toEqual({ activeOnly: true, sort: "queue", dir: "desc" });
  });

  it("drops activeOnly once 'show all' is on", () => {
    expect(
      toOperationsTaskListQuery(
        { ...base, showAll: true },
        { excludeFailurePaused: false },
      ),
    ).not.toHaveProperty("activeOnly");
  });

  it("drops activeOnly when an explicit status is picked — the two would fight", () => {
    const query = toOperationsTaskListQuery(
      { ...base, statusFilter: "completed" },
      { excludeFailurePaused: false },
    );
    expect(query).not.toHaveProperty("activeOnly");
    expect(query.status).toBe("completed");
  });

  it("sends the executor scope and the failure-pause exclusion", () => {
    expect(
      toOperationsTaskListQuery(base, {
        assigneeId: "assignee-7",
        excludeFailurePaused: true,
      }),
    ).toMatchObject({ assigneeId: "assignee-7", excludeFailurePaused: true });
  });

  it("sends scope, type and the debounced search term", () => {
    expect(
      toOperationsTaskListQuery(
        {
          ...base,
          scopeFilter: "transaction",
          typeFilter: "court_visit",
          search: "typing",
        },
        { excludeFailurePaused: false, search: "  settled  " },
      ),
    ).toMatchObject({
      scope: "transaction",
      type: "court_visit",
      q: "settled",
    });
  });

  it("omits a blank search", () => {
    expect(
      toOperationsTaskListQuery(
        { ...base, search: "   " },
        { excludeFailurePaused: false },
      ),
    ).not.toHaveProperty("q");
  });

  it("always asks for the screen's own band order", () => {
    expect(
      toOperationsTaskListQuery(base, { excludeFailurePaused: false }),
    ).toMatchObject({ sort: "queue", dir: "desc" });
  });
});

describe("visibleOperationsTasks", () => {
  function task(over: Partial<OperationsTask> = {}): OperationsTask {
    return {
      id: "1",
      displayId: "OPS-1",
      title: "زيارة محكمة",
      type: "court_visit",
      scope: "transaction",
      status: "created",
      assigneeId: "a1",
      assigneeName: "سالم",
      deeds: ["310107029844"],
      createdAt: "2026-01-01T00:00:00.000Z",
      ...over,
    } as OperationsTask;
  }

  it("no longer re-filters the page by the search term — `q` matched deeds server-side", () => {
    // Before pagination-contract §3 this row was dropped unless the client
    // re-matched `t.deeds.join(" ")`; the endpoint answers the deed term now.
    const rows = [task()];
    expect(
      visibleOperationsTasks(rows, {
        statusFilter: "",
        scopeFilter: "",
        showAll: true,
      }),
    ).toEqual(rows);
  });

  it("still applies status, scope and the active-only toggle to a stale page", () => {
    const rows = [
      task({ id: "1", status: "created" }),
      task({ id: "2", status: "completed" }),
      task({ id: "3", status: "created", scope: "general" }),
    ];
    expect(
      visibleOperationsTasks(rows, {
        statusFilter: "",
        scopeFilter: "transaction",
        showAll: false,
      }).map((t) => t.id),
    ).toEqual(["1"]);
  });

  it("orders by the status band, newest first inside a band", () => {
    const rows = [
      task({ id: "paused", status: "paused" }),
      task({ id: "old", createdAt: "2026-01-01T00:00:00.000Z" }),
      task({ id: "new", createdAt: "2026-02-01T00:00:00.000Z" }),
      task({ id: "done", status: "completed" }),
    ];
    expect(
      visibleOperationsTasks(rows, {
        statusFilter: "",
        scopeFilter: "",
        showAll: true,
      }).map((t) => t.id),
    ).toEqual(["new", "old", "paused", "done"]);
  });
});
