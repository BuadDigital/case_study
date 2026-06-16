"use client";

import { cn } from "@platform/design-system";
import type { RegistrationSource } from "../prototype/registration-data";
import { FLOW_THEME } from "./registration-layout";

export type TypePillOption = { value: string; label: string };

export function TypePills({
  options,
  value,
  onChange,
  error,
  source = "proc",
}: {
  options: TypePillOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  source?: RegistrationSource;
}) {
  const theme = FLOW_THEME[source];

  return (
    <div>
      <div
        className={cn(
          "mb-2 flex flex-wrap gap-1.5",
          error && "[&_button]:border-danger",
        )}
      >
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded border-2 border-border bg-surface px-4 py-2 text-xs font-semibold text-text-2 transition-colors hover:border-primary hover:text-primary",
                selected && theme.pillSelected,
              )}
              onClick={() => onChange(opt.value)}
              aria-pressed={selected}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-1 text-[10.5px] leading-snug text-danger-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
