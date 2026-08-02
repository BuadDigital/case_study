import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";

describe("offline-client store", () => {
  beforeEach(async () => {
    const { closeOfflineDb } = await import("@platform/offline-client");
    await closeOfflineDb();
    indexedDB.deleteDatabase("ejada-offline-v1");
  });

  it("encrypts and restores drafts for the owning user", async () => {
    const {
      saveOfflineDraft,
      getOfflineDraft,
      purgeOfflineData,
    } = await import("@platform/offline-client");

    await saveOfflineDraft({
      id: "field-inspection:task-1",
      userId: "user-a",
      taskId: "task-1",
      kind: "field-inspection",
      payloadJson: JSON.stringify({ note: "معاينة" }),
      updatedAtUtc: new Date().toISOString(),
    });

    const loaded = await getOfflineDraft("user-a", "field-inspection:task-1");
    expect(loaded?.payloadJson).toContain("معاينة");

    await purgeOfflineData("user-a", "test");
    const after = await getOfflineDraft("user-a", "field-inspection:task-1");
    expect(after).toBeNull();
  });

  it("rewrites local attachment placeholders", async () => {
    const { rewriteLocalAttachmentIds } = await import(
      "@platform/offline-client"
    );
    const map = new Map([["local:abc", "server-guid"]]);
    expect(
      rewriteLocalAttachmentIds(
        JSON.stringify({ attachmentId: "local:abc" }),
        map,
      ),
    ).toContain("server-guid");
  });
});
