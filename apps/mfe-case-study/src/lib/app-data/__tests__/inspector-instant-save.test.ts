import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getPartyTaskSubmission: vi.fn(),
  savePartyTaskSubmission: vi.fn(),
}));
vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  ...api,
}));

import { closeOfflineDb } from "@platform/offline-client";
import { readLocalWorkingCopy } from "@platform/app-shared/offline/offline-write";
import { createInspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";
import { draftToPayload, setCache } from "../inspector-workspace-model";
import { updateInspectorWorkspace } from "../inspector-workspace-commands";
import { fetchInspectorWorkspace } from "../inspector-workspace-reads";

const TASK = "task-instant";

function serverDto(payload: Record<string, unknown>, updatedAtUtc: string) {
  return {
    id: "sub-1",
    taskId: TASK,
    kind: "field-inspection",
    status: "reopened",
    payload,
    updatedAtUtc,
  };
}

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
});
afterEach(() => vi.restoreAllMocks());

describe("spec §3.4 — no keystroke lost to the save debounce", () => {
  it("writes the edit to the device before the debounced network save", async () => {
    setCache({
      ...createInspectorWorkspaceDraft({ taskId: TASK, propertyId: "p", poNumber: "PO" }),
      status: "reopened",
    });

    // Not awaited: the network save waits 400 ms; the device copy must not.
    void updateInspectorWorkspace(TASK, { assetNotes: "ملاحظة لم تُرسل" }).catch(() => {});
    await new Promise((r) => setTimeout(r, 50));

    const copy = await readLocalWorkingCopy<{ assetNotes: string }>("field-inspection", TASK);
    expect(copy?.payload.assetNotes).toBe("ملاحظة لم تُرسل");
    expect(api.savePartyTaskSubmission).not.toHaveBeenCalled();
  });

  it("reopens the task from the device copy when the app died before the save", async () => {
    const base = createInspectorWorkspaceDraft({ taskId: TASK, propertyId: "p", poNumber: "PO" });
    const { saveLocalWorkingCopy } = await import("@platform/app-shared/offline/offline-write");
    await saveLocalWorkingCopy({
      taskId: TASK,
      kind: "field-inspection",
      payload: { ...draftToPayload({ ...base, status: "reopened" }), assetNotes: "آخر ما كُتب" },
    });
    api.getPartyTaskSubmission.mockResolvedValue({
      ok: true,
      data: serverDto({ assetNotes: "قديم" }, new Date(Date.now() - 60_000).toISOString()),
    });
    api.savePartyTaskSubmission.mockImplementation(async (_c, _t, payload) => ({
      ok: true,
      data: serverDto(payload as Record<string, unknown>, new Date().toISOString()),
    }));

    const draft = await fetchInspectorWorkspace(TASK);

    expect(draft?.assetNotes).toBe("آخر ما كُتب");
    expect(draft?.status).toBe("reopened");
    await vi.waitFor(() => expect(api.savePartyTaskSubmission).toHaveBeenCalled());
  });
});
