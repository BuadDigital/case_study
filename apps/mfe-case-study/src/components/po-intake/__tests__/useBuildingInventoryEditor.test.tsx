import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BuildingInventoryDto, BuildingInventoryLineDto } from "@platform/api-client";

const api = vi.hoisted(() => ({
  getBuildingInventory: vi.fn(),
  saveBuildingInventory: vi.fn(),
}));
vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  getBuildingInventory: api.getBuildingInventory,
  saveBuildingInventory: api.saveBuildingInventory,
}));
vi.mock("../../../lib/work-orders-api-config", () => ({
  workOrdersApiConfig: () => ({ token: "t" }),
}));

import { useBuildingInventoryEditor } from "../useBuildingInventoryEditor";

const PO = "REQ-7";
const PROPERTY = "prop-1";

function dto(lines: BuildingInventoryLineDto[], componentsText = ""): BuildingInventoryDto {
  return { propertyId: PROPERTY, hasStructuresToValue: lines.length ? "yes" : "no", componentsText, lines };
}

/** Echoes the PUT back the way the server does: ids kept, new rows get `srv-<n>`. */
function echoServer() {
  let n = 0;
  api.saveBuildingInventory.mockImplementation(
    async (_c: unknown, _po: string, _p: string, body: { lines: BuildingInventoryLineDto[]; componentsText?: string }) => ({
      ok: true,
      data: dto(
        body.lines.map((l) => ({ ...l, id: l.id ?? `srv-${++n}` })),
        body.componentsText ?? "",
      ),
    }),
  );
}

function setup(actor: "specialist" | "inspector" = "inspector") {
  return renderHook(() =>
    useBuildingInventoryEditor({ actor, poNumber: PO, propertyId: PROPERTY, taskId: "task-1", autosave: false }),
  );
}

async function typeRow(hook: ReturnType<typeof setup>, index: number, label: string, area = "50") {
  act(() => {
    hook.result.current.patchLine(index, {
      ...hook.result.current.lines[index]!,
      label,
      areaSqm: area,
      itemKey: "custom",
    });
  });
}

beforeEach(() => {
  api.getBuildingInventory.mockReset();
  api.saveBuildingInventory.mockReset();
  api.getBuildingInventory.mockResolvedValue({ ok: true, data: dto([], "نص") });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useBuildingInventoryEditor (specialist actor, direct API)", () => {
  it("loads the table and text, and does not send blank rows", async () => {
    echoServer();
    const hook = setup("specialist");
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.text).toBe("نص");

    act(() => hook.result.current.addLine());
    act(() => hook.result.current.addLine());
    await typeRow(hook, 0, "الدور الأرضي", "200");
    let outcome;
    await act(async () => {
      outcome = await hook.result.current.save();
    });

    expect(outcome).toMatchObject({ ok: true });
    const body = api.saveBuildingInventory.mock.calls[0]![3];
    expect(body.lines).toHaveLength(1);
    expect(body).toMatchObject({ componentsText: "نص", lines: [{ label: "الدور الأرضي", sortOrder: 0 }] });
    // the server's version replaces the screen's when nothing changed meanwhile… but the blank row stays
    expect(hook.result.current.lines.map((l) => l.id)).toContain("srv-1");
  });

  it("reports a half-typed row without calling the server", async () => {
    echoServer();
    const hook = setup("specialist");
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    act(() => hook.result.current.addLine());
    act(() => {
      hook.result.current.patchLine(0, { ...hook.result.current.lines[0]!, areaSqm: "30" });
    });
    let outcome;
    await act(async () => {
      outcome = await hook.result.current.save();
    });
    expect(outcome).toMatchObject({ ok: false, message: "اكتب اسم البند في السطر 1" });
    expect(api.saveBuildingInventory).not.toHaveBeenCalled();
  });

  it("stays closed when the table cannot be loaded (no empty copy to save over it)", async () => {
    api.getBuildingInventory.mockResolvedValue({ ok: false, kind: "network" });
    const hook = setup("specialist");
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.loadError).toBeTruthy();
    act(() => hook.result.current.addLine());
    await typeRow(hook, 0, "سور");
    await act(async () => {
      await hook.result.current.flush();
    });
    expect(api.saveBuildingInventory).not.toHaveBeenCalled();
  });
});

describe("useBuildingInventoryEditor save queue", () => {
  it("is single-flight and coalesces edits made during a save, sending adopted ids", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let n = 0;
    const calls: BuildingInventoryLineDto[][] = [];
    api.saveBuildingInventory.mockImplementation(
      async (_c: unknown, _po: string, _p: string, body: { lines: BuildingInventoryLineDto[] }) => {
        calls.push(body.lines);
        if (calls.length === 1) await gate;
        return { ok: true, data: dto(body.lines.map((l) => ({ ...l, id: l.id ?? `srv-${++n}` }))) };
      },
    );

    const hook = setup("inspector");
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    act(() => hook.result.current.addLine());
    await typeRow(hook, 0, "الدور الأرضي", "200");

    let first!: Promise<unknown>;
    act(() => {
      first = hook.result.current.save();
    });
    await waitFor(() => expect(calls).toHaveLength(1));

    // typing continues while the first PUT is in the air — and a second save is requested
    await typeRow(hook, 0, "الدور الأرضي", "210");
    act(() => hook.result.current.addLine());
    await typeRow(hook, 1, "ملحق علوي", "40");
    let second!: Promise<unknown>;
    act(() => {
      second = hook.result.current.flush();
    });
    expect(calls).toHaveLength(1); // no parallel request

    await act(async () => {
      release();
      await Promise.all([first, second]);
    });

    expect(calls).toHaveLength(2);
    // the second request carries the id the first reply gave «الدور الأرضي», not a stale blank id
    expect(calls[1]!.map((l) => [l.label, l.areaSqm, l.id])).toEqual([
      ["الدور الأرضي", "210", "srv-1"],
      ["ملحق علوي", "40", undefined],
    ]);
    // …and a quick edit after everything settled still carries the final ids
    expect(hook.result.current.lines.map((l) => l.id)).toEqual(["srv-1", "srv-2"]);
    expect(hook.result.current.dirty).toBe(false);
  });

  it("never sends the specialist's report text from the inspector's save", async () => {
    echoServer();
    api.getBuildingInventory.mockResolvedValue({ ok: true, data: dto([], "نص الأخصائي") });
    const hook = setup("inspector");
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    act(() => hook.result.current.addLine());
    await typeRow(hook, 0, "سور", "80");
    await act(async () => {
      await hook.result.current.flush();
    });
    expect(api.saveBuildingInventory.mock.calls[0]![3]).not.toHaveProperty("componentsText");
  });

  it("keeps the table dirty and reports the reason when the server refuses", async () => {
    api.saveBuildingInventory.mockResolvedValue({
      ok: false,
      kind: "validation",
      errors: { _: "المعاينة أُرسلت" },
    });
    const hook = setup("inspector");
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    act(() => hook.result.current.addLine());
    await typeRow(hook, 0, "سور", "80");
    let outcome;
    await act(async () => {
      outcome = await hook.result.current.flush();
    });
    expect(outcome).toMatchObject({ ok: false, message: "المعاينة أُرسلت" });
    expect(hook.result.current.error).toBe("المعاينة أُرسلت");
    expect(hook.result.current.dirty).toBe(true);
  });

  it("autosaves a pause after the last edit", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    echoServer();
    const hook = renderHook(() =>
      useBuildingInventoryEditor({ actor: "inspector", poNumber: PO, propertyId: PROPERTY, autosave: true }),
    );
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    act(() => hook.result.current.addLine());
    act(() => {
      hook.result.current.patchLine(0, { ...hook.result.current.lines[0]!, label: "سور", areaSqm: "80" });
    });
    act(() => {
      hook.result.current.patchLine(0, { ...hook.result.current.lines[0]!, label: "سور", areaSqm: "85" });
    });
    expect(api.saveBuildingInventory).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(api.saveBuildingInventory).toHaveBeenCalledTimes(1);
    expect(api.saveBuildingInventory.mock.calls[0]![3].lines[0]).toMatchObject({ areaSqm: "85" });
  });
});
