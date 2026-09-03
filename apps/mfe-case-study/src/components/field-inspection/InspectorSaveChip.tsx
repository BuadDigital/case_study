"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@platform/ui-kit";

export type InspectorSaveState = "empty" | "draft" | "saved";

/** Matches the design's saveChip: draft while typing, saved ~700ms after the last edit. */
const SETTLE_MS = 700;

/**
 * Per-section save indicator. `markDirty(section)` flips that section to
 * «مسودة» and back to «محفوظ» once edits stop.
 */
export function useInspectorSaveState<K extends string>(initial: Record<K, InspectorSaveState>) {
  const [state, setState] = useState<Record<K, InspectorSaveState>>(initial);
  const timers = useRef<Partial<Record<K, ReturnType<typeof setTimeout>>>>({});

  const markDirty = useCallback((section: K) => {
    setState((prev) => ({ ...prev, [section]: "draft" }));
    const pending = timers.current[section];
    if (pending) clearTimeout(pending);
    timers.current[section] = setTimeout(() => {
      setState((prev) => ({ ...prev, [section]: "saved" }));
    }, SETTLE_MS);
  }, []);

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => {
      for (const timer of Object.values(pendingTimers)) {
        if (timer) clearTimeout(timer as ReturnType<typeof setTimeout>);
      }
    };
  }, []);

  return { saveState: state, markDirty };
}

export function InspectorSaveChip({
  state,
  className,
}: {
  state: InspectorSaveState;
  className?: string;
}) {
  if (state === "empty") return null;
  const draft = state === "draft";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-[3px] text-[10.5px] font-bold whitespace-nowrap",
        draft
          ? "bg-[var(--warning-bg)] text-[var(--amber-text)]"
          : "bg-success-bg text-success-text",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          draft ? "bg-warning" : "bg-[#1f6f6f]",
        )}
        aria-hidden
      />
      {draft ? "مسودة" : "محفوظ"}
    </span>
  );
}
