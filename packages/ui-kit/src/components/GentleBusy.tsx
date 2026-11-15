"use client";

import type { ReactNode } from "react";
import { useDeferredVisible } from "../hooks/use-deferred-visible";
import { isGentleLoadingCopy } from "../lib/gentle-loading-copy";

/**
 * Holds children until `pending` has lasted long enough to be worth showing.
 * Renders no extra DOM — safe inside tables.
 */
export function GentleBusy({
  pending = true,
  children,
  fallback = null,
  handoff = false,
}: {
  pending?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
  /** A page-level loader: shows at once when another page loader has just left (no 300ms gap). */
  handoff?: boolean;
}): ReactNode {
  const show = useDeferredVisible(pending, undefined, handoff);
  if (!pending) return children;
  if (!show) return fallback;
  return children;
}

/** Delays «جاري …» copy; anything else renders immediately. */
export function GentleLoadingCopy({ children }: { children: ReactNode }): ReactNode {
  if (!isGentleLoadingCopy(children)) return children;
  return <GentleBusy>{children}</GentleBusy>;
}
