"use client";

import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";

/**
 * Shared by every sidebar dropdown: entering the desktop icon rail closes the
 * panel (no leftover open flyouts), and while a rail flyout is open a pointer
 * down outside the dropdown root closes it.
 */
export function useRailFlyoutDismiss(
  open: boolean,
  rail: boolean,
  rootRef: RefObject<HTMLElement | null>,
  setOpen: Dispatch<SetStateAction<boolean>>,
): void {
  useEffect(() => {
    // Avoid leftover open flyouts when entering icon-rail.
    if (rail) setOpen(false);
  }, [rail, setOpen]);

  useEffect(() => {
    if (!open || !rail) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, rail, rootRef, setOpen]);
}
