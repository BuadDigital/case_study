"use client";

import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useEffect, useRef } from "react";
import { cn } from "../lib/cn";

/** Exactly one enabled `[role="tab"]` stays in the normal Tab order; the rest drop to `-1`. */
function syncRovingTabIndex(root: HTMLElement) {
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const enabled = tabs.filter((t) => !t.disabled);
  if (enabled.length === 0) return;
  const selected =
    enabled.find((t) => t.getAttribute("aria-selected") === "true") ?? enabled[0];
  for (const t of tabs) {
    t.tabIndex = t === selected ? 0 : -1;
  }
}

export type TabBarProps = HTMLAttributes<HTMLDivElement>;

/**
 * Tab strip (`role="tablist"`) — roving tabindex; arrow keys move focus
 * between enabled tabs (reversed in RTL: →/← follow reading order, not
 * physical direction), Home/End jump to the first/last. Compose with `Tab`
 * (pass `aria-controls` pointing at its `TabPanel`'s `id`) and `TabPanel`.
 */
export function TabBar({ className, onKeyDown, ...props }: TabBarProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rootRef.current) syncRovingTabIndex(rootRef.current);
  });

  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const root = rootRef.current;
    if (!root) return;
    const tabs = Array.from(
      root.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ).filter((t) => !t.disabled);
    if (tabs.length === 0) return;

    const isRtl = getComputedStyle(root).direction === "rtl";
    const forwardKey = isRtl ? "ArrowLeft" : "ArrowRight";
    const backwardKey = isRtl ? "ArrowRight" : "ArrowLeft";
    const active = document.activeElement as HTMLButtonElement | null;
    const currentIndex = Math.max(0, tabs.indexOf(active as HTMLButtonElement));

    let nextIndex: number | null = null;
    if (e.key === forwardKey) nextIndex = (currentIndex + 1) % tabs.length;
    else if (e.key === backwardKey) nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex == null) return;

    e.preventDefault();
    const next = tabs[nextIndex];
    for (const t of tabs) t.tabIndex = t === next ? 0 : -1;
    next.focus();
    // Automatic activation (WAI-ARIA APG default) — the tab's own onClick drives selection.
    next.click();
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex shrink-0 gap-0 overflow-x-auto overscroll-x-contain border-b border-border/50 bg-surface px-4 sm:px-6 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:h-0",
        className,
      )}
      role="tablist"
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

export type TabProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

/** One tab in a `TabBar` — pass `aria-controls` pointing at its `TabPanel`'s `id`, and `disabled` to skip it. */
export function Tab({ className, active, type = "button", ...props }: TabProps) {
  return (
    <button
      type={type}
      role="tab"
      aria-selected={active}
      data-no-action-toast
      className={cn(
        "mb-[-1px] flex items-center gap-1.5 border-b-2 border-transparent bg-transparent px-3.5 py-2.5 text-xs text-text-2 whitespace-nowrap outline-none transition-colors cursor-pointer font-[inherit]",
        "max-lg:min-h-11 max-lg:px-3 max-lg:text-[12.5px]",
        "hover:text-text",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-text-2",
        active && "border-b-primary font-medium text-primary",
        className,
      )}
      {...props}
    />
  );
}

export function TabPanel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tabpanel"
      className={cn(
        "min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5",
        className,
      )}
      {...props}
    />
  );
}
