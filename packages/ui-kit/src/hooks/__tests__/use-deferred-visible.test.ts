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

  // 2026-11-15: the route's loading card, a 300ms empty gap, then the page's own card.
  it("a page loader takes over at once when another just left; an inline one keeps its delay", () => {
    vi.useFakeTimers();
    const first = renderHook(() => useDeferredVisible(true, GENTLE_LOADING_DELAY_MS, true));
    act(() => {
      vi.advanceTimersByTime(GENTLE_LOADING_DELAY_MS);
    });
    expect(first.result.current).toBe(true);
    first.unmount();

    const inline = renderHook(() => useDeferredVisible(true, GENTLE_LOADING_DELAY_MS));
    expect(inline.result.current).toBe(false);
    inline.unmount();

    const next = renderHook(() => useDeferredVisible(true, GENTLE_LOADING_DELAY_MS, true));
    expect(next.result.current).toBe(true);
    next.unmount();

    // Long after, a new wait is quiet again.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    const later = renderHook(() => useDeferredVisible(true, GENTLE_LOADING_DELAY_MS, true));
    expect(later.result.current).toBe(false);
    later.unmount();
  });
});
