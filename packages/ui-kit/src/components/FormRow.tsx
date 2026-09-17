import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type FormRowProps = HTMLAttributes<HTMLDivElement>;

/** Two-column form row (stacks to one column under 561px) — pair fields that belong on the same line (e.g. a date range). */
export function FormRow({
  className,
  ...props
}: FormRowProps) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-3.5 min-[561px]:grid-cols-2", className)}
      {...props}
    />
  );
}
