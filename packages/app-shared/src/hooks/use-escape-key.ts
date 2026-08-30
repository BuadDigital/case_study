"use client";

import { useEffect, useRef } from "react";

/**
 * مستمع Escape واحد يُركَّب فقط عند تبدّل `enabled` — كان كل حوار/لوحة يعيد
 * تركيب المستمع مع كل تغيّر في المُعالج (client-event-listeners). المُعالج
 * يُقرأ من ref فلا حاجة لتثبيته عند المستدعي.
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
