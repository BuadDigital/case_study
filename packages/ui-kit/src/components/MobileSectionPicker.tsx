"use client";

import { useState } from "react";
import { cn } from "../lib/cn";
import { opsPhoneSegCell, opsPhoneSegOff, opsPhoneSegOn, opsPhoneSegTrack } from "../lib/ops-chrome";
import { AppModal } from "./AppModal";

export type MobileSection = {
  id: string;
  label: string;
  /** Live count beside the label. */
  count?: number;
  /** Count reads red (action required). */
  warn?: boolean;
  disabled?: boolean;
};

export type MobileSectionPickerProps = {
  sections: MobileSection[];
  active: string;
  onChange: (id: string) => void;
  /** Sheet title and the trigger's caption, e.g. «القسم». */
  title?: string;
  className?: string;
};

/** Up to 3 short labels fit side by side as a full-width segmented control. */
const SEGMENTED_MAX_SECTIONS = 3;
const SEGMENTED_MAX_LABEL = 14;

function CountBadge({ count, warn, on }: { count: number; warn?: boolean; on?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
        warn && count > 0
          ? "bg-danger-bg text-danger-text"
          : on
            ? "bg-white/15 text-white"
            : "bg-gold-soft text-gold-d",
      )}
    >
      {count}
    </span>
  );
}

/**
 * The phone counterpart of a desktop tab / segment row. Pair it with the
 * desktop row: `<MobileSectionPicker className="lg:hidden" … />` next to the
 * row with `max-lg:hidden`.
 *
 * - ≤3 short sections: a full-width segmented control, equal cells, 44px tall.
 * - More: one full-width button showing the current section and its count;
 *   tapping it opens an `AppModal` (a bottom-docked sheet on phones) listing every section.
 */
export function MobileSectionPicker({
  sections,
  active,
  onChange,
  title = "القسم",
  className,
}: MobileSectionPickerProps) {
  const [open, setOpen] = useState(false);
  const current = sections.find((s) => s.id === active) ?? sections[0];

  const segmented =
    sections.length <= SEGMENTED_MAX_SECTIONS &&
    sections.every((s) => s.label.length <= SEGMENTED_MAX_LABEL);

  if (segmented) {
    return (
      <div
        role="tablist"
        aria-label={title}
        className={cn(opsPhoneSegTrack, className)}
      >
        {sections.map((s) => {
          const on = s.id === active;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={on}
              disabled={s.disabled}
              onClick={() => onChange(s.id)}
              className={cn(
                opsPhoneSegCell,
                "flex items-center justify-center gap-1.5 text-center leading-tight disabled:opacity-50",
                on ? opsPhoneSegOn : opsPhoneSegOff,
              )}
            >
              <span className="min-w-0">{s.label}</span>
              {typeof s.count === "number" ? (
                <CountBadge count={s.count} warn={s.warn} on={on} />
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          "flex min-h-[52px] w-full items-center gap-3 rounded-[12px] border border-border-md bg-surface px-4 py-2 text-start shadow-[0_1px_2px_rgba(15,52,96,0.06)] active:bg-row-hover",
          className,
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] font-medium text-text-3">{title}</span>
          <span className="truncate text-[14px] font-bold text-heading">{current?.label}</span>
        </span>
        {typeof current?.count === "number" ? (
          <CountBadge count={current.count} warn={current.warn} />
        ) : null}
        <span className="text-[11px] font-semibold text-text-3">
          {sections.length} أقسام
        </span>
        <svg
          viewBox="0 0 24 24"
          className="size-4 shrink-0 text-text-3"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <AppModal open={open} title={title} onClose={() => setOpen(false)}>
        <ul className="-m-2 list-none p-0" role="listbox" aria-label={title}>
          {sections.map((s) => {
            const on = s.id === active;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  disabled={s.disabled}
                  onClick={() => {
                    onChange(s.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex min-h-[52px] w-full items-center gap-3 rounded-[10px] px-3 text-start text-[14px] transition-colors",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    on ? "bg-gold-soft font-bold text-heading" : "font-medium text-text active:bg-row-hover",
                  )}
                >
                  <span className="min-w-0 flex-1">{s.label}</span>
                  {typeof s.count === "number" ? (
                    <CountBadge count={s.count} warn={s.warn} />
                  ) : null}
                  <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden>
                    {on ? (
                      <svg viewBox="0 0 24 24" className="size-5 text-gold-d" fill="none" stroke="currentColor" strokeWidth={2.4}>
                        <path d="m5 12 5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </AppModal>
    </>
  );
}
