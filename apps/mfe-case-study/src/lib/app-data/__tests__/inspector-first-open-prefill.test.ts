import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getPartyTaskSubmission: vi.fn(),
  savePartyTaskSubmission: vi.fn(),
}));
vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  ...api,
}));

import { closeOfflineDb } from "@platform/offline-client";
import { getOrCreateInspectorWorkspace } from "../inspector-workspace-commands";
import { emptyProperty } from "../po-intake-data";

const TASK = "task-first-open";

beforeEach(async () => {
  await closeOfflineDb();
  indexedDB.deleteDatabase("ejada-offline-v1");
  localStorage.clear();
  localStorage.setItem(
    "auth",
    JSON.stringify({
      token: "t",
      user: { id: "inspector-1", displayName: "معاين" },
      expiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
    }),
  );
  api.getPartyTaskSubmission.mockReset();
  api.savePartyTaskSubmission.mockReset();
  // No package on the server yet: the inspector opens the task for the first time.
  api.getPartyTaskSubmission.mockResolvedValue({
    ok: true,
    data: { id: "", taskId: TASK, kind: "field-inspection", status: "draft", payload: {}, updatedAtUtc: "" },
  });
  api.savePartyTaskSubmission.mockImplementation(async (_config, _taskId, payload) => ({
    ok: true,
    data: {
      id: "sub-1",
      taskId: TASK,
      kind: "field-inspection",
      status: "draft",
      payload,
      updatedAtUtc: new Date().toISOString(),
    },
  }));
});

describe("the inspector's first open of a task", () => {
  it("already carries the bourse's asset type and usage (not only after a reload)", async () => {
    const draft = await getOrCreateInspectorWorkspace({
      taskId: TASK,
      propertyId: "p-1",
      poNumber: "PO-1",
      property: { ...emptyProperty(), classification: "مبنى مفرد", propertyType: "عمارة" },
    });

    expect(draft?.featureValues.assetSubject).toBe("عمارة");
    expect(draft?.featureValues.propertyUsage).toBe("مبنى مفرد");
    // the movables default still applies
    expect(draft?.featureValues.movables).toBe("لا");
  });
});
