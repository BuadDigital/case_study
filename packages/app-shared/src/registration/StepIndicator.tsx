"use client";

import { cn } from "@platform/design-system";
import { Fragment } from "react";

export function StepIndicator({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <div className="shrink-0 border-b border-border bg-transparent px-4 py-2.5 sm:px-5">
      <div className="mx-auto flex max-w-none items-center justify-center gap-0 overflow-x-auto">
        {steps.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          const lineDone = n < current;

          return (
            <Fragment key={label}>
              <div className="flex min-w-[72px] flex-[0_1_auto] items-center gap-2">
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-border-md bg-surface text-[10px] font-bold text-text-3 transition-all",
                    done && "border-success bg-success-bg text-success-text text-[0]",
                    active && "border-primary bg-primary text-white",
                  )}
                >
                  {done ? (
                    <span
                      className="mt-[-1px] block h-[9px] w-[5px] rotate-45 border-b-2 border-r-2 border-solid border-success"
                      aria-hidden
                    />
                  ) : (
                    n
                  )}
                </div>
                <span
                  className={cn(
                    "max-w-full truncate text-[11px] font-medium text-text-3",
                    active && "font-bold text-primary",
                    done && "text-text-2",
                  )}
                >
                  {label}
                </span>
              </div>
              {i < steps.length - 1 ? (
                <div
                  className={cn(
                    "mx-1 h-0.5 w-7 min-w-5 max-w-10 shrink-0 self-center bg-border",
                    lineDone && "bg-success",
                  )}
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
