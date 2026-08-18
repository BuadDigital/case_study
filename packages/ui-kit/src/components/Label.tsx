import type { LabelHTMLAttributes } from "react";
import { cn } from "../lib/cn";

const sizeClasses = {
  default: "mb-[7px] block text-xs font-semibold text-text-2",
  field: "mb-0 block text-xs font-semibold text-text-2",
} as const;

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  size?: keyof typeof sizeClasses;
};

export function Label({ className, size = "default", ...props }: LabelProps) {
  return (
    <label
      className={cn(sizeClasses[size], className)}
      {...props}
    />
  );
}
