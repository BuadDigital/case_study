import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { closeOfflineDb, OFFLINE_ACCESS_STORAGE_KEY } from "@platform/offline-client";

const api = vi.hoisted(() => ({ getPropertyKeyGate: vi.fn() }));
vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  getPropertyKeyGate: api.getPropertyKeyGate,
}));

import { loadPropertyKeyGate } from "../property-key-gate-offline";

const USER = "inspector-1";
const PARAMS = { propertyId: "prop-1", poNumber: "REQ-7" };
const gate = (keyAvailable: boolean) => ({ keyAvailable, source: "envelope" });

beforeEach(async () => {
  await closeOfflineDb();
  indexedDB.deleteDatabase("ejada-offline-v1");
  localStorage.clear();
  localStorage.setItem(
    "auth",
    JSON.stringify({
      token: "t",
      user: { id: USER, displayName: "معاين" },
      expiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
    }),
  );
  localStorage.setItem(
    OFFLINE_ACCESS_STORAGE_KEY,
    JSON.stringify({ userId: USER, permissions: { prototypeRole: "field-inspector" } }),
  );
  api.getPropertyKeyGate.mockReset();
});

describe("loadPropertyKeyGate", () => {
  it("answers from the device copy when the server is unreachable", async () => {
    api.getPropertyKeyGate.mockResolvedValueOnce({ ok: true, data: gate(true) });
    await expect(loadPropertyKeyGate(PARAMS)).resolves.toEqual(gate(true));

    api.getPropertyKeyGate.mockResolvedValueOnce({ ok: false, kind: "network" });
    await expect(loadPropertyKeyGate(PARAMS)).resolves.toEqual(gate(true));
  });

  it("throws offline when no copy was ever saved — unknown, never «no key»", async () => {
    api.getPropertyKeyGate.mockResolvedValueOnce({ ok: false, kind: "network" });
    await expect(loadPropertyKeyGate(PARAMS)).rejects.toThrow();
  });

  it("does not hide a server failure behind the device copy", async () => {
    api.getPropertyKeyGate.mockResolvedValueOnce({ ok: true, data: gate(false) });
    await loadPropertyKeyGate(PARAMS);

    api.getPropertyKeyGate.mockResolvedValueOnce({ ok: false, kind: "server" });
    await expect(loadPropertyKeyGate(PARAMS)).rejects.toThrow();
  });
});
