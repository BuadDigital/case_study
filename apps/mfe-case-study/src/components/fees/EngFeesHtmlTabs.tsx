"use client";

import type { ReactNode } from "react";
import { cn } from "@platform/design-system";

/** Case Study.html `renderEngFees` / `renderEngSurvey` gold underline tabs. */
export function EngFeesHtmlTabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: {
    id: string;
    label: string;
    count?: number;
    /** When active and count > 0, count uses dispute red (تتطلب إجراءكم). */
    countWarnWhenActive?: boolean;
  }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-4 mt-5 flex gap-0 overflow-x-auto border-b border-border [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const on = active === tab.id;
        const count = tab.count;
        const warn =
          on && tab.countWarnWhenActive && typeof count === "number" && count > 0;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab.id)}
            className={cn(
              "-mb-px shrink-0 border-b-2 bg-transparent px-4 py-2.5 font-[inherit] text-[13px] transition-colors",
              on
                ? "border-gold-d font-bold text-heading"
                : "border-transparent font-medium text-text-2 hover:text-text",
            )}
          >
            {tab.label}
            {typeof count === "number" ? (
              <span
                className={cn(
                  "ms-1 text-[10.5px]",
                  warn ? "text-[#a5432e]" : "text-text-3",
                )}
              >
                ({count})
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Case Study.html `secT(t, sub)`. */
export function EngFeesSectionTitle({
  title,
  sub,
  className,
}: {
  title: string;
  sub: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3.5", className)}>
      <div className="text-[14px] font-bold text-heading">{title}</div>
      <div className="mt-1 text-[11.5px] leading-snug text-text-3">{sub}</div>
    </div>
  );
}
