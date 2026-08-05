"use client";

import type { ReactNode } from "react";
import { Spinner, cn } from "@platform/design-system";

const TONE_CLASS = {
  primary: "text-primary",
  gold: "text-gold-d",
  heading: "text-heading",
} as const;

/**
 * Deed / identifier cell with open-loading feedback for queue tables.
 * Pair with `group/atq-row` on the parent row for hover underline.
 * Default type matches قائمة أوامر العمل primary link (13.5 bold).
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
      className={cn(
        "inline-flex max-w-full flex-col gap-0.5",
        loading && "ui-queue-deed-loading",
        className,
      )}
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
        {loading ? (
          <span
            role="status"
            aria-label="جاري الفتح"
            className="ui-queue-spinner-in inline-flex"
          >
            <Spinner className={cn("size-3", TONE_CLASS[tone])} />
          </span>
        ) : null}
        <span
          dir={rtl ? "rtl" : "ltr"}
          className={cn(
            "inline-block truncate transition-transform duration-150",
            !rtl && "text-end",
            loading && "translate-x-0",
          )}
        >
          {label}
        </span>
        {trailing}
      </span>
      {subtitle}
    </span>
  );
}
