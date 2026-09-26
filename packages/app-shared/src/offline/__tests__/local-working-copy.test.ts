import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { closeOfflineDb, enqueueOutbox } from "@platform/offline-client";
import {
  clearLocalWorkingCopy,
  readLocalWorkingCopy,
  saveLocalWorkingCopy,
} from "../offline-write";

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
});

describe("spec §3.4 — every edit is on the device immediately", () => {
  it("keeps the latest of rapid edits", async () => {
    const writes = ["أ", "أب", "أبج"].map((note) =>
      saveLocalWorkingCopy({ taskId: "t1", kind: "field-inspection", payload: { note } }),
    );
    await Promise.all(writes);

    const copy = await readLocalWorkingCopy<{ note: string }>("field-inspection", "t1");
    expect(copy?.payload.note).toBe("أبج");
  });

  it("is dropped once the server holds it, but not if typing went on", async () => {
    await saveLocalWorkingCopy({ taskId: "t1", kind: "field-inspection", payload: { note: "x" } });
    const before = new Date(Date.now() - 60_000).toISOString();

    await clearLocalWorkingCopy("field-inspection", "t1", before);
    expect(await readLocalWorkingCopy("field-inspection", "t1")).not.toBeNull();

    await clearLocalWorkingCopy("field-inspection", "t1", new Date(Date.now() + 1000).toISOString());
    expect(await readLocalWorkingCopy("field-inspection", "t1")).toBeNull();
  });

  it("is kept while an offline save for the task is still queued", async () => {
    await saveLocalWorkingCopy({ taskId: "t1", kind: "field-inspection", payload: { note: "x" } });
    await enqueueOutbox({
      userId: "inspector-1",
      kind: "party-submission-save",
      targetId: "t1",
      payloadJson: "{}",
    });

    await clearLocalWorkingCopy("field-inspection", "t1", new Date(Date.now() + 1000).toISOString());
    expect(await readLocalWorkingCopy("field-inspection", "t1")).not.toBeNull();
  });
});
