"use client";

import { cn } from "@platform/design-system";

/** iOS-style toggle — matches docs/المعاين/inspector_screen 1.html (.sw / .sl) */
export function InspectorToggleSwitch({
  checked,
  disabled,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <label
      className={cn(
        "relative inline-block h-[23px] w-[42px] shrink-0",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={cn(
          "absolute inset-0 rounded-[23px] bg-border-md transition-colors duration-200",
          "peer-checked:bg-danger",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary/50",
        )}
        aria-hidden
      />
      <span
        className={cn(
          "absolute top-0.5 right-0.5 h-[19px] w-[19px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200",
          "peer-checked:-translate-x-[19px]",
        )}
        aria-hidden
      />
    </label>
  );
}
