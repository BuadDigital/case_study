import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

const toneClasses = {
  default: "bg-surface-2 text-text-2",
  primary: "bg-teal-light text-teal-text",
  success: "bg-success-bg text-success-text",
  warning: "bg-amber-light text-amber-text",
  danger: "bg-danger-bg text-danger-text",
  info: "bg-info-bg text-info-text",
  purple: "bg-purple-bg text-purple",
  orange: "bg-orange-bg text-orange",
} as const;

export type BadgeTone = keyof typeof toneClasses;

export function Badge({
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[20px] px-[9px] py-0.5 text-[11px] font-normal whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
