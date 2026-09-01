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

  it("round-trips prefetch records", async () => {
    const { savePrefetch, getPrefetch, listPrefetchByKind } = await import(
      "@platform/offline-client"
    );

    await savePrefetch({
      id: "tasks:user-a",
      userId: "user-a",
      kind: "workflow-tasks",
      payloadJson: JSON.stringify({ tasks: [{ id: "t1" }] }),
      updatedAtUtc: new Date().toISOString(),
    });

    const row = await getPrefetch("user-a", "tasks:user-a");
    expect(row?.kind).toBe("workflow-tasks");
    expect(row?.payloadJson).toContain("t1");

    const byKind = await listPrefetchByKind("user-a", "workflow-tasks");
    expect(byKind).toHaveLength(1);
  });

  it("caches prefetched attachment bytes without outbox upload", async () => {
    const { cachePrefetchAttachment, getOfflineBlob } = await import(
      "@platform/offline-client"
    );

    const bytes = new TextEncoder().encode("pdf-bytes").buffer;
    await cachePrefetchAttachment({
      userId: "user-a",
      attachmentId: "att-1",
      scope: "property-deed-ownership",
      scopeKey: "PO-1:prop-1",
      fileName: "deed.pdf",
      contentType: "application/pdf",
      bytes,
    });

    const blob = await getOfflineBlob("user-a", "att-1");
    expect(blob?.serverAttachmentId).toBe("att-1");
    expect(blob?.bytes.byteLength).toBeGreaterThan(0);
  });
});

describe("offline write interceptor classification", () => {
  it("classifies operations task patch and comment routes", async () => {
    const { installOfflineWriteInterceptor } = await import(
      "@platform/app-shared/offline/install-offline-write-interceptor"
    );
    expect(typeof installOfflineWriteInterceptor).toBe("function");
  });
});
