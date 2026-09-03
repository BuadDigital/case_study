"use client";

import { useSyncExternalStore } from "react";

// Shared one-second clock: every list screen used to hold useState(new Date()) +
// setInterval rebuilding all rows every second (rerender-defer-reads). Here only
// timer cells subscribe, and the interval stops automatically with the last subscriber.
let nowMs = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) {
    nowMs = Date.now();
    timer = setInterval(() => {
      nowMs = Date.now();
      for (const l of listeners) l();
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return nowMs;
}

/** Epoch ms ticking once per second — subscribe from the leaf that renders the timer, not the view. */
export function useTickingNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function getMinuteSnapshot(): number {
  return Math.floor(nowMs / 60_000);
}

/**
 * Epoch ms at minute granularity — for view-level KPIs/filters that only need
 * coarse freshness. The component re-renders once per minute, not per second.
 */
export function useTickingMinute(): number {
  return useSyncExternalStore(subscribe, getMinuteSnapshot, getMinuteSnapshot) * 60_000;
}
