"use client";

import { useInsertionEffect, useRef, type RefObject } from "react";

/**
 * A ref that always holds the latest `value`, for handlers, timers and effects that must read
 * the current value without re-subscribing. Updated after render (before layout effects) instead
 * of during it, so React's render stays pure (`react-hooks/refs`). Read `.current` in handlers
 * and effects only — never during render. For a callback, prefer React's `useEffectEvent`.
 */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useInsertionEffect(() => {
    ref.current = value;
  });
  return ref;
}
