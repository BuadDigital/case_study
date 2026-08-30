"use client";

import { useSyncExternalStore } from "react";

// Tailwind lg breakpoint — same mobile-card / desktop-table switch as queues.
const QUERY = "(min-width: 1024px)";

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot(): boolean | null {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean | null {
  return null;
}

/**
 * true = desktop, false = mobile, null = unknown (SSR/hydration — keep both trees
 * with CSS classes as before). Mobile and desktop trees used to always mount together:
 * display:none saves paint not render, so every row was built twice (rendering).
 */
export function useViewportDesktop(): boolean | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
