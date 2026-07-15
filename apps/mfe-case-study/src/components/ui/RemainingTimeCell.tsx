import type { RemainingTimeState } from "@case-study/mfe";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function RemainingTimeCell({ state }: { state: RemainingTimeState }) {
  if (state.status === "missing") {
    return <span className="text-text-2">—</span>;
  }

  if (state.status === "overdue") {
    return (
      <span className="inline-block font-sans text-xs font-semibold text-danger-text">
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
