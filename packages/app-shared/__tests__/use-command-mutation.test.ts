import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCommandMutation } from "../src/hooks/use-command-mutation";

describe("useCommandMutation", () => {
  it("passes args + stable key to mutate and blocks concurrent runs", async () => {
    let resolveFirst: (value: string) => void = () => {};
    const first = new Promise<string>((resolve) => {
      resolveFirst = resolve;
    });
    const mutate = vi.fn((_args: { id: string }, _key: string) => first);

    const { result } = renderHook(() => useCommandMutation(mutate));

    let secondPromise: Promise<unknown>;
    await act(async () => {
      void result.current.run({ id: "a" });
      secondPromise = result.current.run({ id: "b" });
    });

    await expect(secondPromise!).resolves.toEqual({ status: "skipped" });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]?.[0]).toEqual({ id: "a" });

    await act(async () => {
      resolveFirst("done");
      await first;
    });
  });

  it("reuses the same key after failure", async () => {
    const mutate = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce("ok");

    const { result } = renderHook(() =>
      useCommandMutation<{ n: number }, string>(mutate),
    );

    await act(async () => {
      await expect(result.current.run({ n: 1 })).rejects.toThrow("network");
    });

    const retryKey = mutate.mock.calls[0]?.[1];

    await act(async () => {
      const retry = await result.current.run({ n: 1 });
      expect(retry).toEqual({ status: "ok", value: "ok" });
    });

    expect(mutate.mock.calls[1]?.[1]).toBe(retryKey);
  });
});
