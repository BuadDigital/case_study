"use client";

import { cn } from "@platform/ui-kit";

type Tone = "heading" | "muted" | "danger";

const TONE_CLASS: Record<Tone, string> = {
  heading: "text-heading",
  muted: "text-text-3",
  danger: "text-red-text",
};

export type ApproachSummaryItem = {
  label: string;
  value: string;
  tone?: Tone;
};

/**
 * Sticky one-line summary at the top of an approach screen: the approach name, its key
 * figures, and the approach indicator on the far side — it stays in view while the appraiser
 * scrolls the tables underneath.
 */
export function ApproachSummaryStrip({
  title,
  items,
  resultLabel,
  result,
  resultTone = "heading",
}: {
  title: string;
  items: ApproachSummaryItem[];
  /** The formula behind the indicator, e.g. «سعر المتر × المساحة =». */
  resultLabel: string;
  result: string;
  resultTone?: Tone;
}) {
  return (
    <div className="sticky top-0 z-[14] bg-[var(--page,#f7f5f0)] py-1 pb-2.5">
      <div className="flex flex-wrap items-center gap-4 rounded-[10px] border border-border-md bg-surface px-[18px] py-[9px] shadow-[0_8px_20px_-18px_rgba(18,40,76,.4)]">
        <span className="text-[13px] font-extrabold text-heading">{title}</span>
        {items.map((item) => (
          <span key={item.label} className="text-[11.5px] text-text-3">
            {item.label}{" "}
            <b dir="ltr" className={TONE_CLASS[item.tone ?? "heading"]}>
              {item.value}
            </b>
          </span>
        ))}
        <span className="ms-auto flex items-baseline gap-[9px]">
          <span className="text-[11.5px] font-bold text-gold-d">{resultLabel}</span>
          <span dir="ltr" className={cn("text-[17px] font-extrabold", TONE_CLASS[resultTone])}>
            {result}
          </span>
        </span>
      </div>
    </div>
  );
}
