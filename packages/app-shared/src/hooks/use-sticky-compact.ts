"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** Enter compact past this scroll offset. */
const COMPACT_AT = 120;
/** Leave compact only below this one — hysteresis, so it cannot flicker. */
const EXPAND_AT = 40;

function scrollParentOf(node: HTMLElement | null): HTMLElement | Window {
  let el = node?.parentElement ?? null;
  while (el) {
    const { overflowY } = getComputedStyle(el);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return window;
}

/**
 * Collapses a sticky header once its scroll container passes `COMPACT_AT`,
 * expanding again only below `EXPAND_AT`.
 *
 * Resolves the nearest scrollable ancestor at mount, so it works whether the
 * page scrolls on the window or inside a `PageShell` canvas.
 */
export function useStickyCompact(
  ref: RefObject<HTMLElement | null>,
  enabled = true,
): boolean {
  const [compact, setCompact] = useState(false);
  const compactRef = useRef(false);
  compactRef.current = compact;

  useEffect(() => {
    if (!enabled) {
      setCompact(false);
      return;
    }
    const target = scrollParentOf(ref.current);

    const read = () =>
      target === window
        ? window.scrollY
        : (target as HTMLElement).scrollTop;

    const onScroll = () => {
      const y = read();
      if (!compactRef.current && y > COMPACT_AT) setCompact(true);
      else if (compactRef.current && y < EXPAND_AT) setCompact(false);
    };

    onScroll();
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [ref, enabled]);

  return enabled && compact;
}
