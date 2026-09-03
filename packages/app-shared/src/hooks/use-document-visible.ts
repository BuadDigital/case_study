"use client";

import { useSyncExternalStore } from "react";

// One module-level subscription: session, notifications, and sync bridges — all
// mounted on every authenticated page — each used to add its own visibilitychange
// listener (client-event-listeners). The listener unbinds automatically with the last subscriber.
const listeners = new Set<() => void>();
let attached = false;

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!attached) {
    attached = true;
    document.addEventListener("visibilitychange", emit);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && attached) {
      attached = false;
      document.removeEventListener("visibilitychange", emit);
    }
  };
}

function getSnapshot(): boolean {
  return document.visibilityState === "visible";
}

function getServerSnapshot(): boolean {
  return true;
}

/**
 * true when the tab is visible. For transition work (hidden → visible), use this
 * value inside an effect keyed on it with a ref of the previous value — not as a one-shot read.
 */
export function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
