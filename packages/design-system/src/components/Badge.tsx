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
  dot = false,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-bold whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span className="size-1.5 shrink-0 rounded-full bg-current opacity-90" />
      ) : null}
      {children}
    </span>
  );
}
