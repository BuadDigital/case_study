import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { closeOfflineDb, listOutboxItems } from "./store";
import {
  enqueueBuildingInventoryLocally,
  enqueueSubmitLocally,
  readQueuedBuildingInventory,
} from "./repository";
import { runOfflineSync, type OfflineSyncDeps } from "./sync";

const USER = "inspector-1";
const PO = "REQ-7";
const PROPERTY = "prop-1";
const TASK = "task-1";

const line = (label: string, areaSqm = "100", id?: string) => ({
  ...(id ? { id } : {}),
  sortOrder: 0,
  label,
  areaSqm,
});

beforeEach(async () => {
  await closeOfflineDb();
  indexedDB.deleteDatabase("ejada-offline-v1");
});

function recordingDeps() {
  const calls: string[] = [];
  const inventoryBodies: Array<{ poNumber: string; propertyId: string; body: unknown }> = [];
  const deps: OfflineSyncDeps = {
    uploadAttachment: async () => ({ ok: true, attachmentId: "att" }),
    saveSubmission: async () => {
      calls.push("save");
      return { ok: true };
    },
    submitSubmission: async () => {
      calls.push("submit");
      return { ok: true };
    },
    saveBuildingInventory: async (input) => {
      calls.push("inventory");
      inventoryBodies.push({
        poNumber: input.poNumber,
        propertyId: input.propertyId,
        body: JSON.parse(input.bodyJson),
      });
      return { ok: true };
    },
  };
  return { deps, calls, inventoryBodies };
}

describe("queued «جدول الحصر» writes", () => {
  it("coalesce into one waiting row per property — the last write wins", async () => {
    await enqueueBuildingInventoryLocally({
      userId: USER,
      poNumber: PO,
      propertyId: PROPERTY,
      taskId: TASK,
      body: { lines: [line("الدور الأرضي")] },
    });
    await enqueueBuildingInventoryLocally({
      userId: USER,
      poNumber: PO,
      propertyId: PROPERTY,
      taskId: TASK,
      body: { lines: [line("الدور الأرضي"), line("ملحق علوي", "40")] },
    });
    await enqueueBuildingInventoryLocally({
      userId: USER,
      poNumber: PO,
      propertyId: "prop-2",
      body: { lines: [line("سور")] },
    });

    const rows = (await listOutboxItems(USER)).filter((i) => i.kind === "building-inventory-save");
    expect(rows).toHaveLength(2);
    const queued = await readQueuedBuildingInventory(USER, PROPERTY);
    expect(queued?.body).toEqual({ lines: [line("الدور الأرضي"), line("ملحق علوي", "40")] });
    expect(queued?.taskId).toBe(TASK);
  });

  it("replay before the submit of the same inspection, whatever the queuing order", async () => {
    await enqueueSubmitLocally({ userId: USER, taskId: TASK });
    await enqueueBuildingInventoryLocally({
      userId: USER,
      poNumber: PO,
      propertyId: PROPERTY,
      taskId: TASK,
      body: { lines: [line("الدور الأرضي")] },
    });
    const { deps, calls, inventoryBodies } = recordingDeps();

    const result = await runOfflineSync(USER, deps);

    expect(calls).toEqual(["inventory", "submit"]);
    expect(inventoryBodies[0]).toMatchObject({ poNumber: PO, propertyId: PROPERTY });
    expect(result).toEqual({ pending: 0, failed: 0 });
    expect(await listOutboxItems(USER)).toHaveLength(0);
  });

  it("hold the submit back while the table is still failing to send (retryable)", async () => {
    await enqueueBuildingInventoryLocally({
      userId: USER,
      poNumber: PO,
      propertyId: PROPERTY,
      taskId: TASK,
      body: { lines: [line("الدور الأرضي")] },
    });
    await enqueueSubmitLocally({ userId: USER, taskId: TASK });
    const { deps, calls } = recordingDeps();
    deps.saveBuildingInventory = async () => ({ ok: false, error: "تعذّر الاتصال" });

    const result = await runOfflineSync(USER, deps);

    expect(calls).toEqual([]);
    expect(result.failed).toBe(2);
    const items = await listOutboxItems(USER);
    expect(items.map((i) => i.kind).sort()).toEqual([
      "building-inventory-save",
      "party-submission-submit",
    ]);
  });

  it("do not hold back the submit of another inspection", async () => {
    await enqueueBuildingInventoryLocally({
      userId: USER,
      poNumber: PO,
      propertyId: PROPERTY,
      taskId: "other-task",
      body: { lines: [line("الدور الأرضي")] },
    });
    await enqueueSubmitLocally({ userId: USER, taskId: TASK });
    const { deps, calls } = recordingDeps();
    deps.saveBuildingInventory = async () => ({ ok: false, error: "تعذّر الاتصال" });

    await runOfflineSync(USER, deps);

    expect(calls).toEqual(["submit"]);
  });

  it("a refused write (403 / «المعاينة أُرسلت…») becomes terminal, stays listed, and does not block the submit", async () => {
    await enqueueBuildingInventoryLocally({
      userId: USER,
      poNumber: PO,
      propertyId: PROPERTY,
      taskId: TASK,
      body: { lines: [line("الدور الأرضي")] },
    });
    await enqueueSubmitLocally({ userId: USER, taskId: TASK });
    const { deps, calls } = recordingDeps();
    deps.saveBuildingInventory = async () => ({
      ok: false,
      error: "المعاينة أُرسلت",
      terminal: true,
    });

    await runOfflineSync(USER, deps);

    expect(calls).toEqual(["submit"]);
    const refused = (await listOutboxItems(USER)).find((i) => i.kind === "building-inventory-save");
    expect(refused).toMatchObject({ status: "terminal", lastError: "المعاينة أُرسلت" });
    // never offered again
    expect(await readQueuedBuildingInventory(USER, PROPERTY)).toBeNull();
  });

  it("keep a newer write that was folded in while the older one was in flight", async () => {
    await enqueueBuildingInventoryLocally({
      userId: USER,
      poNumber: PO,
      propertyId: PROPERTY,
      taskId: TASK,
      body: { lines: [line("أولى")] },
    });
    const { deps } = recordingDeps();
    let sent: unknown;
    deps.saveBuildingInventory = async (input) => {
      sent = JSON.parse(input.bodyJson);
      await enqueueBuildingInventoryLocally({
        userId: USER,
        poNumber: PO,
        propertyId: PROPERTY,
        taskId: TASK,
        body: { lines: [line("أخيرة")] },
      });
      return { ok: true };
    };

    await runOfflineSync(USER, deps);

    expect(sent).toEqual({ lines: [line("أولى")] });
    const queued = await readQueuedBuildingInventory(USER, PROPERTY);
    expect(queued?.body).toEqual({ lines: [line("أخيرة")] });
  });

  it("is refused with a visible reason when the sync handler is not wired", async () => {
    await enqueueBuildingInventoryLocally({
      userId: USER,
      poNumber: PO,
      propertyId: PROPERTY,
      body: { lines: [] },
    });
    const { deps } = recordingDeps();
    delete deps.saveBuildingInventory;

    const result = await runOfflineSync(USER, deps);

    expect(result.failed).toBe(1);
    expect((await listOutboxItems(USER))[0]?.lastError).toBeTruthy();
  });
});
