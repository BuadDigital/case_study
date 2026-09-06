import { describe, expect, it } from "vitest";
import {
  collapseAllPoGroups,
  copyPriorTargetKey,
  filterAllTxMetaToListed,
  queueLoadErrorMessage,
  queueSelectionIsStale,
  resolveQueueTaskFullPagePath,
  type AllTransactionsRowMeta,
} from "../active-transaction-queue-state";
import type { WorkflowTask } from "../../lib/app-data/tasks-storage";

const task = (id: string) => ({ id }) as WorkflowTask;

describe("resolveQueueTaskFullPagePath", () => {
  it("prefers the per-task resolver, then the id path, else the panel", () => {
    const t = task("t1");
    expect(
      resolveQueueTaskFullPagePath(
        {
          resolveFullPageTaskPath: () => "/per-task",
          fullPageTaskPath: (id) => `/by-id/${id}`,
        },
        t,
      ),
    ).toBe("/per-task");
    expect(
      resolveQueueTaskFullPagePath(
        {
          resolveFullPageTaskPath: () => undefined,
          fullPageTaskPath: (id) => `/by-id/${id}`,
        },
        t,
      ),
    ).toBe("/by-id/t1");
    expect(resolveQueueTaskFullPagePath({}, t)).toBeUndefined();
  });
});

describe("queueLoadErrorMessage", () => {
  it("reports the tasks error first, then the PO error, else the generic text", () => {
    expect(queueLoadErrorMessage(new Error("tasks"), new Error("po"))).toBe(
      "tasks",
    );
    expect(queueLoadErrorMessage(null, new Error("po"))).toBe("po");
    expect(queueLoadErrorMessage("not-an-error", undefined)).toBe(
      "تعذّر تحميل قائمة المعاملات",
    );
  });
});

describe("collapseAllPoGroups", () => {
  it("marks every PO collapsed once, however many rows share it", () => {
    expect(
      collapseAllPoGroups([
        { poNumber: "PO-1" },
        { poNumber: "PO-2" },
        { poNumber: "PO-1" },
      ]),
    ).toEqual({ "PO-1": true, "PO-2": true });
    expect(collapseAllPoGroups([])).toEqual({});
  });
});

describe("filterAllTxMetaToListed", () => {
  it("keeps the meta rows whose task survived the filters, in meta order", () => {
    const rows = [
      { task: task("a"), poNumber: "PO-1" },
      { task: task("b"), poNumber: "PO-1" },
      { task: task("c"), poNumber: "PO-2" },
    ] as AllTransactionsRowMeta[];
    const kept = filterAllTxMetaToListed(rows, [task("c"), task("a")]);
    expect(kept.map((r) => r.task.id)).toEqual(["a", "c"]);
  });
});

describe("copyPriorTargetKey", () => {
  it("targets the property when known, else the task slot", () => {
    expect(copyPriorTargetKey(" p-9 ", "t1")).toBe("property:p-9");
    expect(copyPriorTargetKey("   ", "t1")).toBe("slot:t1");
    expect(copyPriorTargetKey(undefined, "t1")).toBe("slot:t1");
  });
});

describe("queueSelectionIsStale", () => {
  it("is stale when the task left the fetch or the listing dropped it", () => {
    const tasks = [task("a"), task("b")];
    expect(
      queueSelectionIsStale({ selectedId: "a", tasks, listed: [task("a")] }),
    ).toBe(false);
    expect(
      queueSelectionIsStale({ selectedId: "b", tasks, listed: [task("a")] }),
    ).toBe(true);
    expect(
      queueSelectionIsStale({ selectedId: "z", tasks, listed: [task("z")] }),
    ).toBe(true);
  });
});
