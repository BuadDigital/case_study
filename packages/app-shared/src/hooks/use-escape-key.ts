"use client";

import { useEffect, useEffectEvent } from "react";

/**
 * Single Escape listener mounted only when `enabled` toggles — every dialog/panel
 * used to remount the listener on every handler change (client-event-listeners).
 * The handler is an Effect Event (always the latest) so callers need not stabilize it.
 */
export function useEscapeKey(enabled: boolean, onEscape: () => void): void {
  const onEscapeEvent = useEffectEvent(onEscape);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscapeEvent();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
