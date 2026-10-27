"use client";

import { cn } from "@platform/ui-kit";

const labelClassName = "mb-[7px] block text-[12px] font-semibold text-text-2";

export type FailureChoice<T extends string> = { value: T; label: string; hint: string };

/**
 * A labelled radio group of option cards (title + one-line hint) — the failure forms' one-of
 * choices: «درجة التعذّر» when raising, «إخطار الأطراف» on the final failure.
 *
 * How it works: a `radiogroup` labelled by the visible caption; each card is a `radio` button
 * whose `aria-checked` follows `value`, and a click reports its option.
 *
 * Edge cases: the cards are 44px tall at least, for phones. It was written inline in the raise
 * fields first; the final-failure dialog needed the same control, so it moved here rather than
 * being copied.
 */
export function FailureChoiceCards<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  options: FailureChoice<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-3">
      <span id={`${id}_label`} className={labelClassName}>
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={`${id}_label`} className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const on = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "min-h-11 rounded-[var(--radius-DEFAULT)] border px-3 py-2 text-start transition-colors duration-150",
                "disabled:cursor-not-allowed disabled:opacity-50",
                on
                  ? "border-primary bg-primary-light/40 text-primary"
                  : "border-border-md bg-surface text-text hover:border-gold",
              )}
            >
              <span className="block text-[12.5px] font-semibold">{option.label}</span>
              <span className="block text-[11px] text-text-3">{option.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
