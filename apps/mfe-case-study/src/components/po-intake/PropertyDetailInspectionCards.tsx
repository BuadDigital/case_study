"use client";

/** Inspection-tab card chrome — shared badge, section card, chip row. */

import { cn } from "@platform/ui-kit";
import { arabicStepLabel } from "../field-inspection/FieldInspectionWorkParts";

export function SharedBadge() {
  return (
    <span className="inline-flex shrink-0 rounded-md border border-[color-mix(in_srgb,var(--info)_40%,var(--border))] bg-info-bg px-2 py-0.5 text-[10px] font-bold text-info-text">
      مشترك
    </span>
  );
}

/** Case Study.html `insCard` — white card, title row, no heavy header strip. */
export function InsCard({
  title,
  badge,
  children,
  step,
  hidden = false,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  /** Section number inside its wizard step. */
  step?: number;
  /** Belongs to a wizard step that is not the active one. */
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <section className="mb-3 rounded-[12px] border border-border bg-surface px-4 py-3.5 shadow-none">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {step != null ? (
          <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--heading)_18%,var(--ink))] text-[14px] font-extrabold text-gold-2">
            {arabicStepLabel(step)}
          </span>
        ) : null}
        <h4 className="m-0 text-[13px] font-bold text-heading">{title}</h4>
        <span className="flex-1" />
        {badge}
      </div>
      {children}
    </section>
  );
}

export function ChipRow({
  items,
  selected,
  onToggle,
  labelOf,
  selectedOnly,
}: {
  items: string[];
  selected: string[];
  onToggle?: (item: string) => void;
  /** Display wording for a stored item value (the value itself is what gets saved). */
  labelOf?: (item: string) => string;
  /** Read view: list only what applies instead of every option greyed out. */
  selectedOnly?: boolean;
}) {
  const shown = selectedOnly ? items.filter((item) => selected.includes(item)) : items;
  if (selectedOnly && shown.length === 0) {
    return <p className="m-0 text-[11.5px] text-text-3">لا شيء مسجّل.</p>;
  }
  return (
    <div className="flex flex-wrap gap-[7px]">
      {shown.map((item) => {
        const on = selected.includes(item);
        const chipClass = cn(
          "inline-flex items-center gap-[5px] rounded-lg border px-[11px] py-[5px] text-[11.5px]",
          on
            ? "border-[color-mix(in_srgb,var(--heading)_35%,var(--border))] bg-success-bg text-heading"
            : "border-border bg-surface-2 text-text-3",
        );
        const content = (
          <>
            {on ? (
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : null}
            {labelOf ? labelOf(item) : item}
          </>
        );
        if (onToggle) {
          return (
            <button
              key={item}
              type="button"
              className={chipClass}
              onClick={() => onToggle(item)}
            >
              {content}
            </button>
          );
        }
        return (
          <span key={item} className={chipClass}>
            {content}
          </span>
        );
      })}
    </div>
  );
}
