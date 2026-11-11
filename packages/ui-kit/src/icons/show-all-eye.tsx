"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "../lib/cn";

const BLINK_MS = 420;

/**
 * Show / hide toggle eye: the eye while everything shows, the same eye with a diagonal line across
 * it while something is hidden — the usual «hidden» symbol (Omar 2026-11-11; the closed state used to
 * squash the eye into a lid line, which did not read as «hidden»).
 *
 * How it works: the eye (outline and pupil) is always drawn; the slash is one stroke drawn in over
 * it when `open` is false and drawn out when it is true; `blink` closes the lids once on the way
 * back to «showing».
 * Edge cases: reduced motion → the slash appears and leaves without the draw.
 */
export function ShowAllEye({
  open,
  blink = false,
  className,
}: {
  open: boolean;
  blink?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-grid size-[15px] shrink-0 [&>*]:[grid-area:1/1]",
        className,
      )}
    >
      <span
        className={cn(
          "inline-grid size-[15px] origin-center [&>*]:[grid-area:1/1]",
          blink &&
            "animate-[show-all-eye-blink_0.42s_ease] motion-reduce:animate-none",
        )}
      >
        <svg
          className="overflow-visible"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        </svg>
        <span className="inline-grid size-[15px]">
          <svg
            className="overflow-visible"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="3" />
          </svg>
        </span>
      </span>
      <svg
        className="overflow-visible"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* The slash: corner to corner (≈ 25 units long), drawn in while hidden. */}
        <path
          data-eye-slash=""
          className={cn(
            "[stroke-dasharray:26] transition-[opacity,stroke-dashoffset] duration-[220ms] ease-out motion-reduce:transition-none",
            open
              ? "opacity-0 [stroke-dashoffset:26]"
              : "opacity-100 [stroke-dashoffset:0]",
          )}
          d="M3 3l18 18"
        />
      </svg>
    </span>
  );
}

/** Blink once when toggling toward the “open / show all” state. */
export function useShowAllEyeBlink() {
  const [blink, setBlink] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerBlink = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setBlink(true);
    timerRef.current = setTimeout(() => {
      setBlink(false);
      timerRef.current = null;
    }, BLINK_MS);
  }, []);

  const toggleOpen = useCallback(
    (prev: boolean) => {
      const next = !prev;
      if (next) triggerBlink();
      return next;
    },
    [triggerBlink],
  );

  return { blink, triggerBlink, toggleOpen };
}
