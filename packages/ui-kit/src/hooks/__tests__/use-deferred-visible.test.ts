import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GENTLE_LOADING_DELAY_MS,
  useDeferredVisible,
} from "../use-deferred-visible";

describe("useDeferredVisible", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays hidden until the delay elapses", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useDeferredVisible(true, GENTLE_LOADING_DELAY_MS),
    );

    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(GENTLE_LOADING_DELAY_MS - 1);
    });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  it("hides immediately when the wait ends before the delay", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ active }) => useDeferredVisible(active, GENTLE_LOADING_DELAY_MS),
      { initialProps: { active: true } },
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ active: false });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(GENTLE_LOADING_DELAY_MS);
    });
    expect(result.current).toBe(false);
  });
});
