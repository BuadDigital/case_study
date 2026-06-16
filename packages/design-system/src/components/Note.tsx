import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

const toneClasses = {
  default: "border-r-text-2 bg-surface-2 text-text-2",
  info: "border-r-info bg-info-bg text-[#1a5276]",
  warn: "border-r-warning bg-warning-bg text-[#784212]",
  success: "border-r-success bg-success-bg text-[#0e6655]",
  danger: "border-r-danger bg-danger-bg text-[#922b21]",
} as const;

export type NoteTone = keyof typeof toneClasses;

export function Note({
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: NoteTone }) {
  return (
    <div
      className={cn(
        "mb-3 rounded-[var(--radius-DEFAULT)] border-r-[3px] border-solid px-3.5 py-2.5 text-[12px] leading-relaxed",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
