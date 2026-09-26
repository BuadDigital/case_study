import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ refreshAuthSession: vi.fn() }));
vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  ...api,
}));

import {
  closeOfflineDb,
  getOfflineDraft,
  saveOfflineDraft,
} from "@platform/offline-client";
import { ensureFreshAuthSession } from "../ensure-fresh-session";

const HOUR = 3_600_000;

async function seedFieldUser() {
  localStorage.setItem(
    "auth",
    JSON.stringify({
      token: "t",
      user: { id: "inspector-1", displayName: "معاين" },
      expiresAtUtc: new Date(Date.now() - HOUR).toISOString(),
      refreshToken: "r",
      refreshTokenExpiresAtUtc: new Date(Date.now() + 8 * HOUR).toISOString(),
    }),
  );
  await saveOfflineDraft({
    id: "field-inspection:task-1",
    userId: "inspector-1",
    taskId: "task-1",
    kind: "field-inspection",
    payloadJson: JSON.stringify({ note: "مسودة" }),
    updatedAtUtc: new Date().toISOString(),
  });
}

beforeEach(async () => {
  await closeOfflineDb();
  indexedDB.deleteDatabase("ejada-offline-v1");
  localStorage.clear();
  api.refreshAuthSession.mockReset();
});

describe("spec §3.4 — disabled user's device is wiped on first connection", () => {
  it("wipes the offline store and the session when the account is disabled", async () => {
    await seedFieldUser();
    api.refreshAuthSession.mockResolvedValue({
      ok: false,
      kind: "auth",
      accountDisabled: true,
    });

    expect(await ensureFreshAuthSession()).toBeNull();

    expect(localStorage.getItem("auth")).toBeNull();
    expect(await getOfflineDraft("inspector-1", "field-inspection:task-1")).toBeNull();
  });

  it("keeps unsynced work when the session merely expired", async () => {
    await seedFieldUser();
    api.refreshAuthSession.mockResolvedValue({ ok: false, kind: "auth" });

    expect(await ensureFreshAuthSession()).toBeNull();

    expect(
      await getOfflineDraft("inspector-1", "field-inspection:task-1"),
    ).not.toBeNull();
  });
});
