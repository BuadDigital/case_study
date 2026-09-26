import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { gcm } from "@noble/ciphers/aes.js";
import {
  closeOfflineDb,
  getOfflineBlob,
  getOfflineDraft,
  listOfflineBlobMeta,
  listOutboxItems,
} from "./store";
import { persistAttachmentLocally, persistDraftLocally } from "./repository";
import { runOfflineSync, type OfflineSyncDeps } from "./sync";
import {
  createUserOfflineKey,
  decryptJson,
  encryptJson,
  type OfflineKey,
} from "./crypto";

const USER = "user-a";
const TASK = "task-1";

beforeEach(async () => {
  await closeOfflineDb();
  indexedDB.deleteDatabase("ejada-offline-v1");
});

describe("software AES-GCM (insecure origins)", () => {
  it("encrypts without Web Crypto and matches standard AES-GCM", async () => {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const key: OfflineKey = { kind: "software", raw };

    const enc = await encryptJson(key, { note: "معاينة ميدانية" });
    expect(new TextDecoder().decode(enc.ciphertext)).not.toContain("معاينة");
    expect(await decryptJson(key, enc)).toEqual({ note: "معاينة ميدانية" });

    // Same bytes as Web Crypto AES-GCM with that key — no home-made format.
    const webKey = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
      "decrypt",
    ]);
    const viaWebCrypto = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(enc.iv) },
      webKey,
      enc.ciphertext,
    );
    expect(JSON.parse(new TextDecoder().decode(viaWebCrypto))).toEqual({
      note: "معاينة ميدانية",
    });
    expect(gcm).toBeTypeOf("function");
  });

  it("stores drafts encrypted when crypto.subtle is missing", async () => {
    const subtle = Object.getOwnPropertyDescriptor(globalThis.crypto, "subtle");
    Object.defineProperty(globalThis.crypto, "subtle", {
      value: undefined,
      configurable: true,
    });
    try {
      expect((await createUserOfflineKey()).kind).toBe("software");

      const { saveOfflineDraft } = await import("./store");
      await saveOfflineDraft({
        id: "field-inspection:http-task",
        userId: "user-http",
        taskId: "http-task",
        kind: "field-inspection",
        payloadJson: JSON.stringify({ note: "نص سري" }),
        updatedAtUtc: new Date().toISOString(),
      });
      const loaded = await getOfflineDraft("user-http", "field-inspection:http-task");
      expect(loaded?.payloadJson).toContain("نص سري");

      const { openDB } = await import("idb");
      const db = await openDB("ejada-offline-v1");
      const row = await db.get("drafts", "field-inspection:http-task");
      db.close();
      expect(row.meta?.encoding).toBeUndefined();
      expect(new TextDecoder().decode(row.ciphertext)).not.toContain("نص سري");
    } finally {
      if (subtle) Object.defineProperty(globalThis.crypto, "subtle", subtle);
    }
  });
});

function recordingDeps() {
  const uploads: Array<Parameters<OfflineSyncDeps["uploadAttachment"]>[0]> = [];
  const saves: string[] = [];
  const deps: OfflineSyncDeps = {
    uploadAttachment: async (input) => {
      uploads.push(input);
      return { ok: true, attachmentId: "server-att-1" };
    },
    saveSubmission: async (input) => {
      saves.push(input.payloadJson);
      return { ok: true };
    },
    submitSubmission: async () => ({ ok: true }),
  };
  return { deps, uploads, saves };
}

describe("offline sync releases local copies", () => {
  it("replays photo metadata and drops bytes, outbox rows and the draft once confirmed", async () => {
    const photoMetadata = {
      latitude: 21.8,
      longitude: 39.09,
      capturedAtUtc: "2026-09-24T07:30:00Z",
    };
    const { localAttachmentId } = await persistAttachmentLocally({
      userId: USER,
      scope: "field-inspection-photo",
      scopeKey: `${TASK}:feature:facade`,
      fileName: "facade.jpg",
      contentType: "image/jpeg",
      bytes: new TextEncoder().encode("jpeg-bytes").buffer,
      uploadExtras: { photoMetadata },
    });
    await persistDraftLocally({
      userId: USER,
      taskId: TASK,
      kind: "field-inspection",
      payload: { facade: localAttachmentId, note: "أولى" },
    });
    await persistDraftLocally({
      userId: USER,
      taskId: TASK,
      kind: "field-inspection",
      payload: { facade: localAttachmentId, note: "أخيرة" },
    });

    // Two autosaves fold into one queued save.
    const queued = await listOutboxItems(USER);
    expect(queued.filter((i) => i.kind === "party-submission-save")).toHaveLength(1);

    const { deps, uploads, saves } = recordingDeps();
    const result = await runOfflineSync(USER, deps);

    expect(result).toEqual({ pending: 0, failed: 0 });
    expect(uploads[0]?.extras).toEqual({ photoMetadata });
    expect(saves).toHaveLength(1);
    expect(saves[0]).toContain("server-att-1");
    expect(saves[0]).toContain("أخيرة");
    expect(saves[0]).not.toContain("local:");

    expect(await listOutboxItems(USER)).toHaveLength(0);
    expect(await getOfflineDraft(USER, `field-inspection:${TASK}`)).toBeNull();
    // Bytes are gone; the encrypted id mapping remains for late rewrites.
    expect(await getOfflineBlob(USER, localAttachmentId)).toBeNull();
    const meta = await listOfflineBlobMeta(USER);
    expect(meta.find((m) => m.id === localAttachmentId)?.serverAttachmentId).toBe(
      "server-att-1",
    );
  });

  it("keeps the draft and the copy while the server rejects the save", async () => {
    await persistDraftLocally({
      userId: USER,
      taskId: TASK,
      kind: "field-inspection",
      payload: { note: "x" },
    });
    const { deps } = recordingDeps();
    deps.saveSubmission = async () => ({ ok: false, error: "server" });

    const result = await runOfflineSync(USER, deps);

    expect(result.failed).toBe(1);
    expect(await getOfflineDraft(USER, `field-inspection:${TASK}`)).not.toBeNull();
    expect(await listOutboxItems(USER)).toHaveLength(1);
  });
});

describe("one sync at a time across tabs", () => {
  it("skips a pass while another tab holds the sync lock", async () => {
    const held = new Set<string>();
    const locks = {
      request: async (
        name: string,
        options: { ifAvailable?: boolean },
        cb: (lock: object | null) => Promise<unknown>,
      ) => {
        if (held.has(name)) return cb(null);
        held.add(name);
        try {
          return await cb({ name });
        } finally {
          held.delete(name);
        }
      },
    };
    Object.defineProperty(navigator, "locks", { value: locks, configurable: true });
    try {
      await persistDraftLocally({
        userId: USER,
        taskId: TASK,
        kind: "field-inspection",
        payload: { note: "x" },
      });
      let saves = 0;
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      const deps: OfflineSyncDeps = {
        uploadAttachment: async () => ({ ok: true, attachmentId: "a" }),
        saveSubmission: async () => {
          saves += 1;
          await gate;
          return { ok: true };
        },
        submitSubmission: async () => ({ ok: true }),
      };

      const first = runOfflineSync(USER, deps);
      await new Promise((r) => setTimeout(r, 50));
      const second = await runOfflineSync(USER, deps); // "another tab"
      release();
      await first;

      expect(saves).toBe(1);
      expect(second.failed).toBe(0);
    } finally {
      delete (navigator as { locks?: unknown }).locks;
    }
  });
});
