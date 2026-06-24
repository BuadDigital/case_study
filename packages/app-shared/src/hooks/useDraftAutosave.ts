"use client";

import { useEffect, useRef } from "react";

const DEFAULT_DEBOUNCE_MS = 400;

export function useDraftAutosave<T>(
  storageKey: string,
  value: T,
  onRestore: (draft: T) => void,
  enabled = true,
) {
  const hydrated = useRef(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      hydrated.current = true;
      return;
    }
    try {
      onRestore(JSON.parse(raw) as T);
    } catch {
      localStorage.removeItem(storageKey);
    } finally {
      hydrated.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once per key
  }, [storageKey, enabled]);

  useEffect(() => {
    if (!enabled || !hydrated.current || typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(value));
    }, DEFAULT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [storageKey, value, enabled]);

  return {
    clearDraft() {
      localStorage.removeItem(storageKey);
    },
  };
}
