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
import { hasUnsavedSections, resetUnsavedSectionsForTests } from "../../../../lib/evaluator/unsaved-edits";

type Props = { editVersion: number; locked?: boolean; hydrateKey?: number };

function setup(initial: Props = { editVersion: 0 }) {
  const cb = {
    buildRequest: vi.fn(() => ({ lines: [] }) as never),
    onSavingChange: vi.fn(),
    onSaved: vi.fn(),
    onManualSaved: vi.fn(),
    onManualFailure: vi.fn(),
  };
  const view = renderHook(
    ({ editVersion, locked = false, hydrateKey = 1 }: Props) =>
      useCostAutosave({ valuationRequestId: "vr-1", locked, editVersion, hydrateKey, ...cb }),
    { initialProps: initial },
  );
  return { ...view, cb };
}

const ok = { ok: true, data: { lines: [{ id: "l1" }] } };

beforeEach(() => {
  vi.useFakeTimers();
  api.saveValuationCostApproach.mockReset();
  api.saveValuationCostApproach.mockResolvedValue(ok);
  resetUnsavedSectionsForTests();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useCostAutosave", () => {
  it("saves once after the pause that follows the last edit, then says so", async () => {
    const { result, rerender, cb } = setup();
    expect(result.current.saveState.status).toBe("idle");

    rerender({ editVersion: 1 });
    expect(result.current.saveState.status).toBe("pending");
    expect(hasUnsavedSections()).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(COST_AUTOSAVE_MS - 100));
    rerender({ editVersion: 2 });
    await act(() => vi.advanceTimersByTimeAsync(COST_AUTOSAVE_MS - 100));
    expect(api.saveValuationCostApproach).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(api.saveValuationCostApproach).toHaveBeenCalledTimes(1);
    expect(cb.onSaved).toHaveBeenCalledWith(ok.data, false);
    expect(cb.onManualSaved).not.toHaveBeenCalled();
    expect(result.current.saveState.status).toBe("saved");
    expect(costSaveStatusText(result.current.saveState)).toBe("تم الحفظ تلقائياً");
    expect(hasUnsavedSections()).toBe(false);
  });

  it("does not autosave without an edit, nor while the package is locked", async () => {
    const { rerender } = setup();
    await act(() => vi.advanceTimersByTimeAsync(COST_AUTOSAVE_MS * 3));
    rerender({ editVersion: 1, locked: true });
    await act(() => vi.advanceTimersByTimeAsync(COST_AUTOSAVE_MS * 3));
    expect(api.saveValuationCostApproach).not.toHaveBeenCalled();
  });

  it("a refused autosave shows the reason without a toast and waits for the next edit", async () => {
    api.saveValuationCostApproach.mockResolvedValueOnce({
      ok: false,
      kind: "validation",
      errors: { "lines[0].label": "تسمية البند مطلوبة" },
    });
    const { result, rerender, cb } = setup();
    rerender({ editVersion: 1 });
    await act(() => vi.advanceTimersByTimeAsync(COST_AUTOSAVE_MS));
    expect(result.current.saveState.status).toBe("error");
    expect(costSaveStatusText(result.current.saveState)).toContain("تسمية البند مطلوبة");
    expect(cb.onManualFailure).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(COST_AUTOSAVE_MS * 3));
    expect(api.saveValuationCostApproach).toHaveBeenCalledTimes(1);

    rerender({ editVersion: 2 });
    expect(result.current.saveState.status).toBe("pending");
    await act(() => vi.advanceTimersByTimeAsync(COST_AUTOSAVE_MS));
    expect(api.saveValuationCostApproach).toHaveBeenCalledTimes(2);
  });

  it("keeps the explicit save: always sends, toasts through the manual callbacks", async () => {
    const { result, cb } = setup();
    await act(() => result.current.saveNow());
    expect(api.saveValuationCostApproach).toHaveBeenCalledTimes(1);
    expect(cb.onManualSaved).toHaveBeenCalledOnce();

    api.saveValuationCostApproach.mockResolvedValueOnce({ ok: false, kind: "server" });
    await act(() => result.current.saveNow());
    expect(cb.onManualFailure).toHaveBeenCalledOnce();
  });

  it("an edit made while a save is in flight keeps its draft and is saved next", async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    api.saveValuationCostApproach.mockImplementationOnce(
      () => new Promise((r) => (resolveFirst = r)),
    );
    const { rerender, cb } = setup();
    rerender({ editVersion: 1 });
    await act(() => vi.advanceTimersByTimeAsync(COST_AUTOSAVE_MS));
    rerender({ editVersion: 2 });
    await act(async () => resolveFirst(ok));
    expect(cb.onSaved).toHaveBeenLastCalledWith(ok.data, true);
    await act(() => vi.advanceTimersByTimeAsync(COST_AUTOSAVE_MS));
    expect(api.saveValuationCostApproach).toHaveBeenCalledTimes(2);
    expect(cb.onSaved).toHaveBeenLastCalledWith(ok.data, false);
  });

  it("leaving the screen sends the edit still waiting for its pause", async () => {
    const { rerender, unmount } = setup();
    rerender({ editVersion: 1 });
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(api.saveValuationCostApproach).toHaveBeenCalledTimes(1);
  });

  it("a full reload drops what was pending (the drafts are the server's again)", async () => {
    const { result, rerender } = setup();
    rerender({ editVersion: 1, hydrateKey: 1 });
    rerender({ editVersion: 1, hydrateKey: 2 });
    expect(result.current.saveState.status).toBe("idle");
    await act(() => vi.advanceTimersByTimeAsync(COST_AUTOSAVE_MS * 2));
    expect(api.saveValuationCostApproach).not.toHaveBeenCalled();
  });
});
