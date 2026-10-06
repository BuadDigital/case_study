import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeOfflineDb,
  enqueueOutbox,
  listOutboxItems,
  OFFLINE_ACCESS_STORAGE_KEY,
} from "@platform/offline-client";

const api = vi.hoisted(() => ({
  getBuildingInventory: vi.fn(),
  saveBuildingInventory: vi.fn(),
}));
vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  getBuildingInventory: api.getBuildingInventory,
  saveBuildingInventory: api.saveBuildingInventory,
}));

import {
  classifyWrite,
  enqueueClassified,
} from "../install-offline-write-interceptor";
import {
  loadBuildingInventoryWithOffline,
  parseBuildingInventoryPath,
  saveBuildingInventoryWithOffline,
} from "../building-inventory-offline";

const USER = "inspector-1";
const PO = "REQ-7";
const PROPERTY = "prop-1";
const CONFIG = { token: "t" };

const line = (label: string, id?: string) => ({
  ...(id ? { id } : {}),
  sortOrder: 0,
  structureKind: "floor",
  label,
  areaSqm: "100",
});
const dto = (...labels: string[]) => ({
  propertyId: PROPERTY,
  hasStructuresToValue: "yes",
  componentsText: "نص الأخصائي",
  lines: labels.map((l) => line(l, `id-${l}`)),
});

function goOffline(offline: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(!offline);
}

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
  api.getBuildingInventory.mockReset();
  api.saveBuildingInventory.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("building inventory path + interceptor classification", () => {
  it("reads both ids out of the PUT route", () => {
    expect(
      parseBuildingInventoryPath(`/api/work-orders/${encodeURIComponent("REQ 7")}/properties/${PROPERTY}/building-inventory`),
    ).toEqual({ poNumber: "REQ 7", propertyId: PROPERTY });
    expect(parseBuildingInventoryPath("/api/work-orders/REQ-7/properties/p/inspection-limits")).toBeNull();
  });

  it("classifies only the PUT as the offline-queueable building-inventory write", async () => {
    const url = `http://localhost:5000/api/work-orders/${PO}/properties/${PROPERTY}/building-inventory`;
    const body = JSON.stringify({ lines: [line("الدور الأرضي")] });
    expect(await classifyWrite({ input: url, init: { method: "PUT", body }, method: "PUT" })).toEqual({
      type: "building-inventory-save",
      poNumber: PO,
      propertyId: PROPERTY,
      body: { lines: [line("الدور الأرضي")] },
    });
    expect(await classifyWrite({ input: url, init: { method: "PATCH" }, method: "PATCH" })).toBeNull();
  });

  it("enqueues a classified write into the coalescing queue (second PUT replaces the first)", async () => {
    for (const label of ["أولى", "أخيرة"]) {
      await enqueueClassified(USER, {
        type: "building-inventory-save",
        poNumber: PO,
        propertyId: PROPERTY,
        body: { lines: [line(label)] },
      });
    }
    const rows = (await listOutboxItems(USER)).filter((i) => i.kind === "building-inventory-save");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetId).toBe(PROPERTY);
    expect(rows[0]?.payloadJson).toContain("أخيرة");
    expect(rows[0]?.payloadJson).not.toContain("أولى");
  });
});

describe("offline save + read of the table", () => {
  it("queues the write without calling the API while offline, and reads it back", async () => {
    goOffline(true);
    const res = await saveBuildingInventoryWithOffline(
      CONFIG,
      PO,
      PROPERTY,
      { lines: [line("الدور الأرضي"), line("غرفة حارس")] },
      "task-1",
    );
    expect(res).toMatchObject({ ok: true, queued: true });
    expect(api.saveBuildingInventory).not.toHaveBeenCalled();

    const read = await loadBuildingInventoryWithOffline(CONFIG, PO, PROPERTY);
    expect(read).toMatchObject({ ok: true, fromDevice: true });
    expect(read.ok && read.data.lines.map((l) => l.label)).toEqual(["الدور الأرضي", "غرفة حارس"]);
  });

  it("a queued write wins over the server copy (the inspector's newest typing)", async () => {
    goOffline(true);
    await saveBuildingInventoryWithOffline(CONFIG, PO, PROPERTY, { lines: [line("محلي")] });
    goOffline(false);
    api.getBuildingInventory.mockResolvedValue({ ok: true, data: dto("خادم") });

    const read = await loadBuildingInventoryWithOffline(CONFIG, PO, PROPERTY);

    expect(api.getBuildingInventory).not.toHaveBeenCalled();
    expect(read.ok && read.data.lines[0]?.label).toBe("محلي");
  });

  it("opens the downloaded copy offline, and refuses (never an empty table) without one", async () => {
    api.getBuildingInventory.mockResolvedValue({ ok: true, data: dto("الدور الأرضي") });
    const online = await loadBuildingInventoryWithOffline(CONFIG, PO, PROPERTY);
    expect(online).toMatchObject({ ok: true });
    expect("fromDevice" in online && online.fromDevice).toBeFalsy();

    goOffline(true);
    const offline = await loadBuildingInventoryWithOffline(CONFIG, PO, PROPERTY);
    expect(offline).toMatchObject({ ok: true, fromDevice: true });
    expect(offline.ok && offline.data.lines[0]?.label).toBe("الدور الأرضي");

    const never = await loadBuildingInventoryWithOffline(CONFIG, PO, "prop-never-downloaded");
    expect(never).toEqual({ ok: false, kind: "network" });
  });

  it("falls back to the copy when the server is unreachable while 'online'", async () => {
    api.getBuildingInventory.mockResolvedValueOnce({ ok: true, data: dto("الدور الأرضي") });
    await loadBuildingInventoryWithOffline(CONFIG, PO, PROPERTY);
    api.getBuildingInventory.mockResolvedValueOnce({ ok: false, kind: "network" });

    const read = await loadBuildingInventoryWithOffline(CONFIG, PO, PROPERTY);

    expect(read).toMatchObject({ ok: true, fromDevice: true });
  });

  it("an online save sends straight to the API and drops an older queued write", async () => {
    await enqueueOutbox({
      userId: USER,
      kind: "building-inventory-save",
      targetId: PROPERTY,
      payloadJson: JSON.stringify({ poNumber: PO, propertyId: PROPERTY, body: { lines: [] } }),
    });
    api.saveBuildingInventory.mockResolvedValue({ ok: true, data: dto("جديد") });

    const res = await saveBuildingInventoryWithOffline(CONFIG, PO, PROPERTY, { lines: [line("جديد")] });

    expect(res).toMatchObject({ ok: true, queued: false });
    expect(api.saveBuildingInventory).toHaveBeenCalledOnce();
    expect((await listOutboxItems(USER)).filter((i) => i.kind === "building-inventory-save")).toHaveLength(0);
  });

  it("queues on a network failure, but surfaces a server refusal", async () => {
    api.saveBuildingInventory.mockResolvedValueOnce({ ok: false, kind: "network" });
    const queued = await saveBuildingInventoryWithOffline(CONFIG, PO, PROPERTY, { lines: [line("أ")] });
    expect(queued).toMatchObject({ ok: true, queued: true });

    api.saveBuildingInventory.mockResolvedValueOnce({
      ok: false,
      kind: "validation",
      errors: { _: "المعاينة أُرسلت" },
    });
    const refused = await saveBuildingInventoryWithOffline(CONFIG, PO, PROPERTY, { lines: [line("ب")] });
    expect(refused).toMatchObject({ ok: false, kind: "validation" });
  });

  it("does not queue for a non-field session (the real error shows)", async () => {
    localStorage.removeItem(OFFLINE_ACCESS_STORAGE_KEY);
    api.saveBuildingInventory.mockResolvedValue({ ok: false, kind: "network" });
    const res = await saveBuildingInventoryWithOffline(CONFIG, PO, PROPERTY, { lines: [line("أ")] });
    expect(res).toMatchObject({ ok: false, kind: "network" });
    expect(await listOutboxItems(USER)).toHaveLength(0);
  });
});
