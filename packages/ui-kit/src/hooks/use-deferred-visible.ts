"use client";

import { useEffect, useLayoutEffect, useState } from "react";

/** Wait this long before showing loading chrome so fast cached opens stay quiet. */
export const GENTLE_LOADING_DELAY_MS = 300;

/**
 * A page loader that appears within this long after another one left takes over at once — it is
 * the same wait continuing (route chunk → work order → page), not a new one.
 */
const HANDOFF_WINDOW_MS = 1000;

/** When a page loader was last on screen (0 = never). Module-wide: every page loader shares it. */
let lastVisibleAt = 0;

function loaderJustLeft(): boolean {
  return lastVisibleAt > 0 && Date.now() - lastVisibleAt < HANDOFF_WINDOW_MS;
}

// Layout effects warn during server rendering; there is no screen to hand off on the server anyway.
const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Becomes true only after `active` has stayed true for `delayMs`.
 * Turns off immediately when `active` is false — no trailing spinner.
 *
 * How it works: a timer turns it on after the delay. A page loader (`handoff`) that mounts while
 * another one has just left (the route's «جاري التحميل…» card handing over to the page's own) skips
 * the delay — set in a layout effect, before the first paint, so no empty frame shows between the
 * two. Inline loaders keep their quiet delay.
 * Edge cases: fixed 2026-11-15 — opening a property page showed the card, an empty gap of 300ms, then
 * a second card, as if one loading finished and another began. The first render stays hidden on the
 * server and the client alike, so hydration matches.
 */
export function useDeferredVisible(
  active: boolean,
  delayMs = GENTLE_LOADING_DELAY_MS,
  /** A page-level loader (the centred card): takes over at once from one that just left. */
  handoff = false,
): boolean {
  const [visible, setVisible] = useState(false);
  // Off as soon as `active` drops (reset during render, so the delay restarts next time).
  if (!active && visible) setVisible(false);

  useClientLayoutEffect(() => {
    if (handoff && active && loaderJustLeft()) setVisible(true);
  }, [active, handoff]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);

  // While on screen, and at the moment it leaves, stamp the time for the next loader.
  useEffect(() => {
    if (!handoff || !visible) return;
    lastVisibleAt = Date.now();
    return () => {
      lastVisibleAt = Date.now();
    };
  }, [visible, handoff]);

  return visible;
}
