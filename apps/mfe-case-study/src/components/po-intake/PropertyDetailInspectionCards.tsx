"use client";

/** Inspection-tab card chrome — shared badge, section card, chip row. */

import { cn } from "@platform/ui-kit";
import { arabicStepLabel } from "../field-inspection/FieldInspectionWorkParts";

export function SharedBadge() {
  return (
    <span className="inline-flex shrink-0 rounded-md border border-[color-mix(in_srgb,#8b5cf6_30%,transparent)] bg-[color-mix(in_srgb,#8b5cf6_14%,transparent)] px-2 py-0.5 text-[10px] font-bold text-[#6b46c1]">
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
          <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-ink text-[14px] font-extrabold text-[var(--gold-2,#c8b591)]">
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
}: {
  items: string[];
  selected: string[];
  onToggle?: (item: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-[7px]">
      {items.map((item) => {
        const on = selected.includes(item);
        const chipClass = cn(
          "inline-flex items-center gap-[5px] rounded-lg border px-[11px] py-[5px] text-[11.5px]",
          on
            ? "border-[color-mix(in_srgb,#1f6f6f_30%,transparent)] bg-[color-mix(in_srgb,#2a8f8f_12%,transparent)] text-[#1f6f6f]"
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
            {item}
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
