import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function FormRow({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", className)}
      {...props}
    />
  );
}
