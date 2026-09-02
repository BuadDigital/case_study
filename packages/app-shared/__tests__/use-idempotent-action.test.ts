import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIdempotentAction } from "../src/hooks/use-idempotent-action";

describe("useIdempotentAction", () => {
  it("blocks concurrent execute calls and clears key on success", async () => {
    let resolveFirst: (value: string) => void = () => {};
    const first = new Promise<string>((resolve) => {
      resolveFirst = resolve;
    });
    const action = vi.fn((_key: string) => first);

    const { result } = renderHook(() => useIdempotentAction(action));

    let secondPromise: Promise<unknown>;
    await act(async () => {
      void result.current.execute();
      secondPromise = result.current.execute();
    });

    await expect(secondPromise!).resolves.toEqual({ status: "skipped" });
    expect(action).toHaveBeenCalledTimes(1);
    const firstKey = action.mock.calls[0]?.[0];
    expect(firstKey).toBeTruthy();

    await act(async () => {
      resolveFirst("done");
      await first;
    });

    action.mockResolvedValueOnce("again");
    await act(async () => {
      const next = await result.current.execute();
      expect(next).toEqual({ status: "ok", value: "again" });
    });

    expect(action).toHaveBeenCalledTimes(2);
    const secondKey = action.mock.calls[1]?.[0];
    expect(secondKey).toBeTruthy();
    expect(secondKey).not.toBe(firstKey);
  });

  it("keeps the same key after failure for retry", async () => {
    const action = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce("ok");

    const { result } = renderHook(() => useIdempotentAction(action));

    await act(async () => {
      await expect(result.current.execute()).rejects.toThrow("network");
    });

    const retryKey = action.mock.calls[0]?.[0];

    await act(async () => {
      const retry = await result.current.execute();
      expect(retry).toEqual({ status: "ok", value: "ok" });
    });

    expect(action.mock.calls[1]?.[0]).toBe(retryKey);
  });
});
