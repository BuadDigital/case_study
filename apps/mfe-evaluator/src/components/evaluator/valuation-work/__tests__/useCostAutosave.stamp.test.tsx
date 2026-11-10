import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ saveValuationCostApproach: vi.fn() }));

vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  ...api,
}));
vi.mock("../lib/shell-utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/shell-utils")>()),
  apiConfig: () => ({ token: "t" }),
}));

import { useCostAutosave } from "../useCostAutosave";
import { COST_AUTOSAVE_MS, costSaveStatusText } from "../lib/cost-autosave";
import { resetUnsavedSectionsForTests } from "../../../../lib/evaluator/unsaved-edits";

const T0 = "2026-11-10T08:00:00.0000000Z";
const T1 = "2026-11-10T08:00:01.0000000Z";
const T2 = "2026-11-10T08:00:02.0000000Z";
const STALE = "حفظ مستخدم آخر تعديلات أحدث — أعد تحميل الصفحة";

type Props = { editVersion: number; hydrateKey?: number; loaded?: string };

function setup(initial: Props) {
  const cb = {
    buildRequest: vi.fn(() => ({ lines: [] }) as never),
    onSavingChange: vi.fn(),
    onSaved: vi.fn(),
    onManualSaved: vi.fn(),
    onManualFailure: vi.fn(),
    onLeaveFailure: vi.fn(),
    onConflict: vi.fn(),
  };
  const view = renderHook(
    ({ editVersion, hydrateKey = 1, loaded }: Props) =>
      useCostAutosave({
        valuationRequestId: "vr-1",
        locked: false,
        editVersion,
        hydrateKey,
        loadedUpdatedAtUtc: loaded,
        ...cb,
      }),
    { initialProps: initial },
  );
  return { ...view, cb };
}

function sentStamp(call: number): unknown {
  return (api.saveValuationCostApproach.mock.calls[call]![2] as { expectedUpdatedAtUtc?: string })
    .expectedUpdatedAtUtc;
}

beforeEach(() => {
  vi.useFakeTimers();
  api.saveValuationCostApproach.mockReset();
  resetUnsavedSectionsForTests();
});
afterEach(() => vi.useRealTimers());

describe("cost autosave stamp — two tabs (2026-11-10)", () => {
  it("sends the loaded stamp, then the one its own save returned — sequential saves never conflict", async () => {
    api.saveValuationCostApproach
      .mockResolvedValueOnce({ ok: true, data: { lines: [], updatedAtUtc: T1 } })
      .mockResolvedValueOnce({ ok: true, data: { lines: [], updatedAtUtc: T2 } });
    const { rerender } = setup({ editVersion: 0, loaded: T0 });
    rerender({ editVersion: 1, loaded: T0 });
    await act(() => vi.advanceTimersByTimeAsync(COST_AUTOSAVE_MS));
    rerender({ editVersion: 2, loaded: T0 });
    await act(() => vi.advanceTimersByTimeAsync(COST_AUTOSAVE_MS));
    expect(sentStamp(0)).toBe(T0);
    expect(sentStamp(1)).toBe(T1);
  });

  it("omits the stamp when nothing was loaded (no check) and sends empty for a never-saved approach", async () => {
    api.saveValuationCostApproach.mockResolvedValue({ ok: true, data: { lines: [] } });
    const unknown = setup({ editVersion: 0 });
    await act(() => unknown.result.current.saveNow());
    expect(sentStamp(0)).toBeUndefined();
    unknown.unmount();

    const fresh = setup({ editVersion: 0, loaded: "" });
    await act(() => fresh.result.current.saveNow());
    expect(sentStamp(1)).toBe("");
  });

  it("a silent reload carrying another tab's stamp is not adopted; a full load is", async () => {
    api.saveValuationCostApproach.mockResolvedValue({ ok: true, data: { lines: [] } });
    const { result, rerender } = setup({ editVersion: 0, loaded: T0 });
    rerender({ editVersion: 0, loaded: T2 }); // same hydrateKey — silent reload
    await act(() => result.current.saveNow());
    expect(sentStamp(0)).toBe(T0);
    rerender({ editVersion: 0, loaded: T2, hydrateKey: 2 }); // full load
    await act(() => result.current.saveNow());
    expect(sentStamp(1)).toBe(T2);
  });

  it("a 409 keeps the reason on the status line and calls onConflict once per load", async () => {
    api.saveValuationCostApproach.mockResolvedValue({ ok: false, kind: "conflict", message: STALE });
    const { result, rerender, cb } = setup({ editVersion: 0, loaded: T0 });
    rerender({ editVersion: 1, loaded: T0 });
    await act(() => vi.advanceTimersByTimeAsync(COST_AUTOSAVE_MS));
    expect(costSaveStatusText(result.current.saveState)).toContain(STALE);
    rerender({ editVersion: 2, loaded: T0 });
    await act(() => vi.advanceTimersByTimeAsync(COST_AUTOSAVE_MS));
    expect(api.saveValuationCostApproach).toHaveBeenCalledTimes(2);
    expect(cb.onConflict).toHaveBeenCalledOnce();
    expect(cb.onConflict).toHaveBeenCalledWith(STALE);
    // The explicit save reports it through the manual path, not twice.
    await act(() => result.current.saveNow());
    expect(cb.onManualFailure).toHaveBeenCalledOnce();
    expect(cb.onConflict).toHaveBeenCalledOnce();
  });
});
