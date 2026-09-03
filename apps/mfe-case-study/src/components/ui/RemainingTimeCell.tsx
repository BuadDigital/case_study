"use client";

import { pad2 } from "@platform/app-shared/format/date";
import { useTickingNow } from "@platform/app-shared/hooks/use-ticking-now";
import {
  resolveRemainingTime,
  type RemainingTimeState,
} from "../../lib/app-data/my-task-row";

export function RemainingTimeCell({ state }: { state: RemainingTimeState }) {
  if (state.status === "missing") {
    return <span className="text-text-2">—</span>;
  }

  if (state.status === "overdue") {
    return (
      <span className="inline-block font-sans text-xs font-medium text-danger-text">
        متأخر
      </span>
    );
  }

  const { days, hours, minutes, seconds } = state;

  return (
    <span
      className="inline-block font-sans text-xs font-medium tracking-wide text-text-2 tabular-nums"
      dir="ltr"
      title="أيام.ساعات.دقائق.ثوانٍ"
      aria-label={`${days} أيام و ${pad2(hours)} ساعة و ${pad2(minutes)} دقيقة و ${pad2(seconds)} ثانية`}
    >
      {days}.{pad2(hours)}.{pad2(minutes)}.{pad2(seconds)}
    </span>
  );
}

/**
 * Countdown that ticks every second inside the cell itself — clock subscription lives here, not on the screen,
 * so every row is not rebuilt each second (rerender-defer-reads).
 */
export function TickingRemainingTimeCell({ dueIso }: { dueIso: string }) {
  const nowMs = useTickingNow();
  return <RemainingTimeCell state={resolveRemainingTime(dueIso, new Date(nowMs))} />;
}
