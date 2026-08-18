import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type FormGroupProps = HTMLAttributes<HTMLDivElement> & {
  hasError?: boolean;
};

export function FormGroup({
  className,
  hasError,
  ...props
}: FormGroupProps) {
  return (
    <div
      className={cn("mb-3.5 flex min-w-0 flex-col gap-1.5", hasError && "has-error", className)}
      {...props}
    />
  );
}
