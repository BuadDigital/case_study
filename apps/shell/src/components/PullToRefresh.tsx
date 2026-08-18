"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "@platform/ui-kit";

const PULL_THRESHOLD = 72;
const MAX_PULL = 112;

/**
 * Native browser pull-to-refresh is blocked by the shell's `overflow: hidden`.
 * Attach this to the `#content` scroll element for standalone PWA / mobile.
 */
export function usePullToRefresh(
  scrollRef: RefObject<HTMLElement | null>,
  onRefresh: () => Promise<void>,
  enabled: boolean,
) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const setPullBoth = useCallback((value: number) => {
    pullRef.current = value;
    setPull(value);
  }, []);

  const reset = useCallback(() => {
    startY.current = null;
    pulling.current = false;
    setPullBoth(0);
  }, [setPullBoth]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (el.scrollTop > 2) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0]?.clientY ?? null;
      pulling.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (refreshingRef.current || startY.current == null) return;
      if (el.scrollTop > 2) {
        reset();
        return;
      }
      const y = e.touches[0]?.clientY ?? startY.current;
      const delta = y - startY.current;
      if (delta <= 0) {
        if (pulling.current) setPullBoth(0);
        pulling.current = false;
        return;
      }
      pulling.current = true;
      const resisted = Math.min(MAX_PULL, delta * 0.45);
      setPullBoth(resisted);
      if (resisted > 8) e.preventDefault();
    };

    const onTouchEnd = () => {
      if (refreshingRef.current) return;
      const shouldRefresh =
        pulling.current && pullRef.current >= PULL_THRESHOLD;
      if (!shouldRefresh) {
        reset();
        return;
      }
      refreshingRef.current = true;
      setRefreshing(true);
      setPullBoth(PULL_THRESHOLD);
      void (async () => {
        try {
          await onRefreshRef.current();
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          reset();
        }
      })();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", reset);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", reset);
    };
  }, [scrollRef, enabled, reset, setPullBoth]);

  return { pull, refreshing, threshold: PULL_THRESHOLD };
}

export function PullToRefreshIndicator({
  pull,
  refreshing,
  threshold,
}: {
  pull: number;
  refreshing: boolean;
  threshold: number;
}) {
  const armed = pull >= threshold || refreshing;
  const visible = pull > 4 || refreshing;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-2 transition-[opacity,transform] duration-150",
        visible ? "opacity-100" : "opacity-0",
      )}
      style={{
        transform: `translateY(${Math.max((refreshing ? threshold : pull) * 0.25, 0)}px)`,
      }}
      aria-live="polite"
      aria-busy={refreshing}
    >
      <div
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-full border border-border bg-surface px-3 text-[12px] font-semibold text-text-2 shadow-[0_4px_16px_rgba(15,52,96,0.12)]",
          armed && "border-primary/30 text-primary",
        )}
      >
        <span
          className={cn(
            "inline-block size-3.5 rounded-full border-2 border-current border-t-transparent",
            (refreshing || armed) && "animate-spin",
          )}
        />
        {refreshing
          ? "جاري التحديث…"
          : armed
            ? "أفلت للتحديث"
            : "اسحب للتحديث"}
      </div>
    </div>
  );
}
