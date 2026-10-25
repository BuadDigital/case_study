import { cn } from "../lib/cn";

const OPTIONS = [
  [true, "نعم"],
  [false, "لا"],
] as const;

/** «نعم / لا» radio pair for checklist rows — green when yes, red when no. */
export function YesNoToggle({
  name,
  value,
  disabled,
  onChange,
  block,
}: {
  name: string;
  value: boolean | null;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  /** Phone card: full width, 44px-tall halves. */
  block?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="نعم أو لا"
      className={cn(
        "inline-flex rounded-[var(--radius-DEFAULT)] border border-border-md bg-surface-2 p-0.5",
        block && "flex w-full",
      )}
    >
      {OPTIONS.map(([v, label]) => {
        const on = value === v;
        return (
          <button
            key={String(v)}
            type="button"
            role="radio"
            name={name}
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={cn(
              "min-w-[44px] rounded-[calc(var(--radius-DEFAULT)-2px)] border border-transparent px-2.5 py-1.5 text-[12px] font-semibold transition-colors",
              block && "min-h-11 flex-1 text-[13px]",
              "disabled:cursor-not-allowed disabled:opacity-55",
              on
                ? v
                  ? "border-[color-mix(in_srgb,#3f8f5f_35%,transparent)] bg-[color-mix(in_srgb,#3f8f5f_14%,transparent)] text-[#2f7a4d]"
                  : "border-[color-mix(in_srgb,#d9694f_35%,transparent)] bg-[color-mix(in_srgb,#d9694f_12%,transparent)] text-[#a5432e]"
                : "bg-transparent text-text-2 hover:bg-surface hover:text-heading",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
