"use client";

import { useEffect, useRef } from "react";

/**
 * Single Escape listener mounted only when `enabled` toggles — every dialog/panel
 * used to remount the listener on every handler change (client-event-listeners).
 * The handler is read from a ref so callers need not stabilize it.
 */
export function useEscapeKey(enabled: boolean, onEscape: () => void): void {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscapeRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
