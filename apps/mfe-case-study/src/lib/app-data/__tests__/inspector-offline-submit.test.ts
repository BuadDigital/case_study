import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeOfflineDb, listOutboxItems } from "@platform/offline-client";
import { createInspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";
import { setCache } from "../inspector-workspace-model";
import { submitInspectorWorkspace } from "../inspector-workspace-commands";

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
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
});
afterEach(() => vi.restoreAllMocks());

describe("ق-10 — a submit queued offline carries the on-site completion stamp", () => {
  it("queues one save with completedOnSiteAtUtc and one submit", async () => {
    const draft = {
      ...createInspectorWorkspaceDraft({ taskId: "task-9", propertyId: "p", poNumber: "PO" }),
      inspectionDate: "2026-09-01",
      inspectionTime: "08:00",
    };
    setCache(draft);

    const before = Date.now();
    const result = await submitInspectorWorkspace("task-9", "key-1");
    expect(result.ok && result.queued).toBe(true);

    const items = await listOutboxItems("inspector-1");
    const saves = items.filter((i) => i.kind === "party-submission-save");
    const submits = items.filter((i) => i.kind === "party-submission-submit");
    expect(saves).toHaveLength(1);
    expect(submits).toHaveLength(1);

    const payload = JSON.parse(saves[0]!.payloadJson) as Record<string, string>;
    expect(Date.parse(payload.completedOnSiteAtUtc!)).toBeGreaterThanOrEqual(before - 1000);
    expect(payload.inspectionDate).not.toBe("2026-09-01");
  });
});
