import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getPartyTaskSubmission: vi.fn(),
  savePartyTaskSubmission: vi.fn(),
}));
vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  ...api,
}));

import { closeOfflineDb } from "@platform/offline-client";
import { createInspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";
import { loadInspectorWorkspace, setCache } from "../inspector-workspace-model";
import {
  saveInspectorWorkspaceDraft,
  updateInspectorWorkspace,
} from "../inspector-workspace-commands";

const TASK = "task-queue";

function serverDto(payload: Record<string, unknown>) {
  return {
    id: "sub-1",
    taskId: TASK,
    kind: "field-inspection",
    status: "reopened",
    payload,
    updatedAtUtc: new Date().toISOString(),
  };
}

/** PUT n (1-based) waits for `gates[n - 1]`; every PUT's payload is recorded in order. */
function slowServer(
  gates: Array<Promise<void>>,
  answer: (payload: Record<string, unknown>, n: number) => Record<string, unknown> = (p) => p,
) {
  const sent: Array<Record<string, unknown>> = [];
  api.savePartyTaskSubmission.mockImplementation(async (_config, _taskId, payload) => {
    const n = sent.push(payload as Record<string, unknown>);
    await gates[n - 1];
    return { ok: true, data: serverDto(answer(payload as Record<string, unknown>, n)) };
  });
  return sent;
}

function gate() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

const tick = (ms = 15) => new Promise((r) => setTimeout(r, ms));

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
  api.getPartyTaskSubmission.mockReset();
  api.savePartyTaskSubmission.mockReset();
  setCache({
    ...createInspectorWorkspaceDraft({ taskId: TASK, propertyId: "p", poNumber: "PO" }),
    status: "reopened",
  });
});
afterEach(() => vi.restoreAllMocks());

describe("inspector whole-draft PUTs are serialised per task", () => {
  it("runs overlapping saves one at a time, the second built on the first's result", async () => {
    const first = gate();
    const sent = slowServer([first.promise, Promise.resolve()], (payload, n) =>
      n === 1 ? { ...payload, propertyDisplayId: "رقم من الخادم" } : payload,
    );

    const a = saveInspectorWorkspaceDraft(loadInspectorWorkspace(TASK)!);
    const b = saveInspectorWorkspaceDraft(loadInspectorWorkspace(TASK)!);
    await tick();
    expect(api.savePartyTaskSubmission).toHaveBeenCalledTimes(1);

    first.open();
    await Promise.all([a, b]);
    expect(sent).toHaveLength(2);
    // Built when it ran — on the first PUT's answer, not on the cache it was enqueued against.
    expect(sent[1]!.propertyDisplayId).toBe("رقم من الخادم");
  });

  it("keeps an edit typed while a PUT is in flight, and sends it next", async () => {
    const first = gate();
    const sent = slowServer([first.promise, Promise.resolve()]);

    const a = saveInspectorWorkspaceDraft(loadInspectorWorkspace(TASK)!);
    await tick();
    const edit = updateInspectorWorkspace(TASK, { assetNotes: "كُتبت أثناء الحفظ" }, { immediate: true });
    await tick();
    expect(api.savePartyTaskSubmission).toHaveBeenCalledTimes(1);

    first.open();
    // The older PUT's answer does not overwrite the newer edit on the device.
    expect((await a).assetNotes).toBe("كُتبت أثناء الحفظ");
    expect(loadInspectorWorkspace(TASK)?.assetNotes).toBe("كُتبت أثناء الحفظ");

    await edit;
    expect(sent.map((p) => p.assetNotes)).toEqual(["", "كُتبت أثناء الحفظ"]);
  });

  it("applies a save's own change to the draft as it is when the PUT runs", async () => {
    const first = gate();
    const sent = slowServer([first.promise, Promise.resolve(), Promise.resolve()]);
    const stale = loadInspectorWorkspace(TASK)!;

    const a = saveInspectorWorkspaceDraft(stale);
    await tick();
    const edit = updateInspectorWorkspace(TASK, { assetNotes: "ملاحظة" }, { immediate: true });
    const confirmed = saveInspectorWorkspaceDraft(stale, (latest) => ({
      ...latest,
      inspectionConfirmed: true,
    }));

    first.open();
    await Promise.all([a, edit, confirmed]);
    expect(sent).toHaveLength(3);
    expect(sent[2]).toMatchObject({ assetNotes: "ملاحظة", inspectionConfirmed: true });
  });
});
