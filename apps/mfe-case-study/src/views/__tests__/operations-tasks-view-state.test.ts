import { describe, expect, it } from "vitest";
import {
  INITIAL_OPERATIONS_TASK_QUERY,
  operationsTaskQueryReducer,
  toOperationsTaskListQuery,
  type OperationsTaskQueryState,
} from "../operations-tasks-view-state";

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
