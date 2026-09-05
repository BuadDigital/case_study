import { describe, expect, it } from "vitest";
import type { OfflineOutboxItem } from "@platform/offline-client";
import {
  activeOutboxItems,
  ageHours,
  arrayBufferToBase64,
  buildFieldSyncHeartbeat,
  isAuthRejected,
  isStaleOutboxItem,
  matchExistingAttachment,
  offlineLeaseToasts,
  outboxKindLabel,
  parseReplayPayload,
  pendingUnloadWarning,
  replayFailure,
  syncStatusIcon,
  syncStatusLabel,
  unauthenticatedReplayFailure,
} from "../offline-sync-state";

const item = (
  overrides: Partial<OfflineOutboxItem> & Pick<OfflineOutboxItem, "id">,
): OfflineOutboxItem => ({
  userId: "u1",
  kind: "attachment-upload",
  status: "pending",
  createdAtUtc: "2026-09-01T10:00:00.000Z",
  updatedAtUtc: "2026-09-01T10:00:00.000Z",
  attempts: 0,
  targetId: "t",
  payloadJson: "{}",
  ...overrides,
});

describe("activeOutboxItems", () => {
  it("keeps pending, uploading and failed rows in order and drops the rest", () => {
    const rows = [
      item({ id: "a", status: "pending" }),
      item({ id: "b", status: "done" as OfflineOutboxItem["status"] }),
      item({ id: "c", status: "uploading" }),
      item({ id: "d", status: "failed" }),
    ];
    expect(activeOutboxItems(rows).map((r) => r.id)).toEqual(["a", "c", "d"]);
  });
});

describe("buildFieldSyncHeartbeat", () => {
  it("reports an idle queue without an oldest timestamp", () => {
    expect(
      buildFieldSyncHeartbeat([], { displayName: "Ahmed", roleId: "field-inspector" }),
    ).toEqual({
      pendingCount: 0,
      kinds: [],
      displayName: "Ahmed",
      roleId: "field-inspector",
    });
  });

  it("finds the oldest active row and the distinct kinds in first-seen order", () => {
    const rows = [
      item({ id: "a", kind: "party-submission-save", createdAtUtc: "2026-09-02T00:00:00.000Z" }),
      item({ id: "b", kind: "attachment-upload", createdAtUtc: "2026-09-01T00:00:00.000Z" }),
      item({ id: "c", kind: "party-submission-save", createdAtUtc: "2026-09-03T00:00:00.000Z" }),
      item({ id: "d", kind: "key-envelope-create", status: "done" as OfflineOutboxItem["status"], createdAtUtc: "2026-08-01T00:00:00.000Z" }),
    ];
    expect(buildFieldSyncHeartbeat(rows, { roleId: "field-inspector" })).toEqual({
      pendingCount: 3,
      oldestPendingAtUtc: "2026-09-01T00:00:00.000Z",
      kinds: ["party-submission-save", "attachment-upload"],
      displayName: undefined,
      roleId: "field-inspector",
    });
  });
});

describe("syncStatusLabel / syncStatusIcon", () => {
  it("locked wins over every sync state", () => {
    expect(syncStatusLabel({ locked: true, syncState: "syncing", pending: 3 })).toBe(
      "جلسة offline مقفلة",
    );
  });

  it("labels each state and mentions the queue depth when offline or idle", () => {
    expect(syncStatusLabel({ locked: false, syncState: "syncing", pending: 2 })).toBe("جاري المزامنة");
    expect(syncStatusLabel({ locked: false, syncState: "offline", pending: 2 })).toBe(
      "دون اتصال — 2 في طابور الحفظ",
    );
    expect(syncStatusLabel({ locked: false, syncState: "offline", pending: 0 })).toBe("دون اتصال");
    expect(syncStatusLabel({ locked: false, syncState: "failed", pending: 0 })).toBe(
      "فشلت المزامنة — إعادة محاولة",
    );
    expect(syncStatusLabel({ locked: false, syncState: "synced", pending: 4 })).toBe("4 بانتظار المزامنة");
    expect(syncStatusLabel({ locked: false, syncState: "synced", pending: 0 })).toBe("تمت المزامنة");
  });

  it("picks the icon from the state, then the queue depth", () => {
    expect(syncStatusIcon("syncing", 0)).toBe("🕓");
    expect(syncStatusIcon("failed", 0)).toBe("⚠️");
    expect(syncStatusIcon("synced", 1)).toBe("⚠️");
    expect(syncStatusIcon("synced", 0)).toBe("✅");
  });
});

describe("staleness and labels", () => {
  it("measures age in hours and treats unparsable dates as fresh", () => {
    const now = Date.parse("2026-09-01T12:00:00.000Z");
    expect(ageHours("2026-09-01T09:30:00.000Z", now)).toBeCloseTo(2.5);
    expect(ageHours("not-a-date", now)).toBe(0);
    expect(isStaleOutboxItem({ createdAtUtc: "2026-09-01T10:00:00.000Z" }, now)).toBe(true);
    expect(isStaleOutboxItem({ createdAtUtc: "2026-09-01T10:00:01.000Z" }, now)).toBe(false);
  });

  it("labels every outbox kind in Arabic and echoes unknown kinds", () => {
    expect(outboxKindLabel("attachment-upload")).toBe("رفع مرفق");
    expect(outboxKindLabel("key-envelope-handoff-confirm")).toBe("تأكيد مناولة");
    expect(outboxKindLabel("something-new")).toBe("something-new");
  });

  it("builds the unload warning and lease toasts", () => {
    expect(pendingUnloadWarning(3)).toContain("3 عناصر");
    expect(offlineLeaseToasts({ warn1h: false, warn2h: false })).toEqual([]);
    expect(offlineLeaseToasts({ warn1h: true, warn2h: true })).toEqual([
      "مضت ساعة دون اتصال — تبقى ساعتان قبل القفل",
      "مضت ساعتان دون اتصال — تبقى ساعة قبل القفل",
    ]);
  });
});

describe("replay failure classification", () => {
  it("treats auth and forbidden as terminal, others as retryable", () => {
    expect(isAuthRejected("auth")).toBe(true);
    expect(isAuthRejected("forbidden")).toBe(true);
    expect(isAuthRejected("server")).toBe(false);
    expect(replayFailure("auth", "x")).toEqual({ ok: false, error: "x", terminal: true });
    expect(replayFailure("server", "x")).toEqual({ ok: false, error: "x", terminal: false });
    expect(replayFailure("validation", "x")).toEqual({ ok: false, error: "x", terminal: false });
  });

  it("makes validation terminal only when the handler opts in", () => {
    expect(replayFailure("validation", "x", { validationTerminal: true }).terminal).toBe(true);
    expect(replayFailure("server", "x", { validationTerminal: true }).terminal).toBe(false);
  });

  it("marks a missing session as terminal", () => {
    expect(unauthenticatedReplayFailure()).toEqual({
      ok: false,
      error: "غير مصادق",
      terminal: true,
    });
  });
});

describe("payload helpers", () => {
  it("parses JSON payloads and returns null for corrupt rows", () => {
    expect(parseReplayPayload<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
    expect(parseReplayPayload("{oops")).toBeNull();
  });

  it("matches an existing attachment by name and size, else the first row", () => {
    const rows = [
      { id: "1", fileName: "a.jpg", sizeBytes: 10 },
      { id: "2", fileName: "b.jpg", sizeBytes: 20 },
    ];
    expect(matchExistingAttachment(rows, { fileName: "b.jpg", byteLength: 20 })?.id).toBe("2");
    expect(matchExistingAttachment(rows, { fileName: "c.jpg", byteLength: 5 })?.id).toBe("1");
    expect(matchExistingAttachment([], { fileName: "c.jpg", byteLength: 5 })).toBeUndefined();
  });

  it("base64-encodes raw bytes", () => {
    expect(arrayBufferToBase64(new TextEncoder().encode("hi").buffer)).toBe("aGk=");
  });
});
