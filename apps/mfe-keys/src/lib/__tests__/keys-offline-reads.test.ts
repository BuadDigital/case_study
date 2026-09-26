import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KeyEnvelopeDto, PropertyCourtAccessDto } from "@platform/api-client";

const api = vi.hoisted(() => ({
  listKeyEnvelopes: vi.fn(),
  getKeyEnvelope: vi.fn(),
  listPropertyCourtAccess: vi.fn(),
}));

vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  ...api,
}));

import { closeOfflineDb, enqueueOutbox } from "@platform/offline-client";
import {
  loadKeyEnvelope,
  loadKeyEnvelopes,
  loadPropertyCourtAccess,
  prefetchKeyEnvelopesForOffline,
} from "../keys-envelope-api";

const envelope = {
  id: "env-1",
  requestNumber: "REQ-7",
  court: "المحكمة العامة بجدة",
  circuit: "3",
  keysCountLabeled: 2,
  keysCountActual: 2,
  countMismatch: false,
  status: "reviewer",
  assignments: [],
  handoffs: [],
  timeline: [],
  linkedProperties: [],
} as unknown as KeyEnvelopeDto;

const access = {
  id: "acc-1",
  propertyId: "prop-1",
  requestNumber: "REQ-7",
  hasEnablingLetter: true,
} as unknown as PropertyCourtAccessDto;

function setOnline(online: boolean) {
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(online);
}

beforeEach(async () => {
  await closeOfflineDb();
  indexedDB.deleteDatabase("ejada-offline-v1");
  localStorage.clear();
  localStorage.setItem(
    "auth",
    JSON.stringify({
      token: "t",
      user: { id: "reviewer-1", displayName: "مراجع" },
      expiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
    }),
  );
  api.listKeyEnvelopes.mockResolvedValue({ ok: true, data: [envelope] });
  api.listPropertyCourtAccess.mockResolvedValue({ ok: true, data: [access] });
  api.getKeyEnvelope.mockResolvedValue({ ok: false, kind: "network" });
});

afterEach(() => vi.restoreAllMocks());

describe("keys screens offline (government reviewer)", () => {
  it("serves the prefetched envelopes, detail and court access offline", async () => {
    setOnline(true);
    await prefetchKeyEnvelopesForOffline();
    expect(api.listPropertyCourtAccess).toHaveBeenCalledWith(expect.anything(), "REQ-7");

    setOnline(false);
    api.listKeyEnvelopes.mockClear();

    const rows = await loadKeyEnvelopes();
    expect(rows.map((r) => r.id)).toEqual(["env-1"]);
    expect(api.listKeyEnvelopes).not.toHaveBeenCalled();

    const detail = await loadKeyEnvelope("env-1");
    expect(detail.ok && detail.data.court).toBe("المحكمة العامة بجدة");

    const courtAccess = await loadPropertyCourtAccess("REQ-7");
    expect(courtAccess.map((a) => a.id)).toEqual(["acc-1"]);
  });

  it("falls back to the snapshot when the network drops mid-request", async () => {
    setOnline(true);
    await prefetchKeyEnvelopesForOffline();
    api.listKeyEnvelopes.mockResolvedValue({ ok: false, kind: "network" });

    expect((await loadKeyEnvelopes()).map((r) => r.id)).toEqual(["env-1"]);
    expect((await loadKeyEnvelope("env-1")).ok).toBe(true);
  });

  it("lists an envelope registered offline and opens it before it syncs", async () => {
    setOnline(false);
    await enqueueOutbox({
      userId: "reviewer-1",
      kind: "key-envelope-create",
      targetId: "local-pending:abc",
      payloadJson: JSON.stringify({
        requestNumber: "REQ-9",
        court: "محكمة",
        circuit: "1",
        keysCountLabeled: 1,
        keysCountActual: 1,
        clientEnvelopeId: "local-pending:abc",
      }),
    });

    const rows = await loadKeyEnvelopes();
    expect(rows[0]?.id).toBe("local-pending:abc");
    const detail = await loadKeyEnvelope("local-pending:abc");
    expect(detail.ok && detail.data.requestNumber).toBe("REQ-9");
  });
});
