"use client";

import type { ReactNode } from "react";
import { cn } from "@platform/ui-kit";

const TONE_CLASS = {
  primary: "text-primary",
  gold: "text-gold-d",
  heading: "text-heading",
} as const;

/**
 * Deed / identifier cell for queue tables.
 * Loading feedback is on the full row (`.ui-queue-row-opening`) — no inline spinner.
 * Pair with `group/atq-row` on the parent row for hover underline.
 */
export function InteractiveDeedCell({
  label,
  loading = false,
  tone = "primary",
  rtl = false,
  trailing,
  subtitle,
  className,
  labelClassName,
}: {
  label: string;
  loading?: boolean;
  tone?: keyof typeof TONE_CLASS;
  /** Use when the label is Arabic (e.g. «قيد الدراسة»). */
  rtl?: boolean;
  trailing?: ReactNode;
  subtitle?: ReactNode;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <span
      className={cn("inline-flex max-w-full flex-col gap-0.5", className)}
      aria-busy={loading || undefined}
    >
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 text-[12.5px] font-bold",
          "underline-offset-2 transition-[opacity,transform,color] duration-150",
          TONE_CLASS[tone],
          loading ? "opacity-90" : "group-hover/atq-row:underline",
          labelClassName,
        )}
      >
        {/* Trailing first so in RTL it sits on the physical right (start). */}
        {trailing}
        <span
          dir={rtl ? "rtl" : "ltr"}
          className={cn(
            "inline-block truncate transition-transform duration-150",
            !rtl && "text-end",
          )}
        >
          {label}
        </span>
      </span>
      {loading ? (
        <span className="sr-only" role="status">
          جاري الفتح
        </span>
      ) : null}
      {subtitle}
    </span>
  );
}
