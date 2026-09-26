import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listWorkflowTasksPage: vi.fn(),
  listOperationsTasksPage: vi.fn(),
}));
vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  ...api,
}));

import { closeOfflineDb, savePrefetch } from "@platform/offline-client";
import { loadWorkflowTasksPage } from "../tasks-reads";
import { loadOperationsTasksPage } from "../operations-tasks-reads";

function signIn(fieldRole: boolean) {
  localStorage.setItem(
    "auth",
    JSON.stringify({
      token: "t",
      user: { id: "inspector-1", displayName: "معاين" },
      expiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
    }),
  );
  if (fieldRole) {
    localStorage.setItem(
      "ejada_offline_access",
      JSON.stringify({
        userId: "inspector-1",
        permissions: {
          userId: "inspector-1",
          identityRoles: [],
          prototypeRole: "field-inspector",
          pages: [],
          capabilities: [],
        },
      }),
    );
  }
}

beforeEach(async () => {
  await closeOfflineDb();
  indexedDB.deleteDatabase("ejada-offline-v1");
  localStorage.clear();
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
});
afterEach(() => vi.restoreAllMocks());

describe("spec §4.2 — field lists offline never show a connection error", () => {
  it("gives a field user an empty queue when nothing was downloaded yet", async () => {
    signIn(true);
    const page = await loadWorkflowTasksPage({ page: 1, pageSize: 25 });
    expect(page.rows).toEqual([]);
    expect(api.listWorkflowTasksPage).not.toHaveBeenCalled();

    const ops = await loadOperationsTasksPage({ page: 1, pageSize: 25 });
    expect(ops.rows).toEqual([]);
  });

  it("pages the downloaded queue with the screen's filters", async () => {
    signIn(true);
    await savePrefetch({
      id: "tasks:inspector-1",
      userId: "inspector-1",
      kind: "workflow-tasks",
      payloadJson: JSON.stringify({
        tasks: [
          { id: "t-1", kind: "field-inspection", status: "open" },
          { id: "t-2", kind: "property-appraisal", status: "open" },
        ],
      }),
      updatedAtUtc: new Date().toISOString(),
    });

    const page = await loadWorkflowTasksPage({ kind: ["field-inspection"] });
    expect(page.rows.map((t) => t.id)).toEqual(["t-1"]);
    expect(page.totalCount).toBe(1);
  });

  it("still reports the failure to office roles, who have no offline copy", async () => {
    signIn(false);
    await expect(loadWorkflowTasksPage({ page: 1 })).rejects.toThrow();
  });
});
