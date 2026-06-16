import type { SelectHTMLAttributes } from "react";
import { cn } from "../lib/cn";
import {
  formControlClassName,
  formControlErrorClassName,
} from "../lib/form-control-classes";

export type SelectVariant = "default" | "sidebar";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  hasError?: boolean;
  variant?: SelectVariant;
};

export function Select({
  className,
  hasError,
  variant = "default",
  ...props
}: SelectProps) {
  return (
    <select
      className={cn(
        "w-full cursor-pointer font-inherit outline-none transition-colors",
        variant === "default" &&
          cn(formControlClassName, "cursor-pointer"),
        variant === "sidebar" &&
          "rounded-[var(--radius-DEFAULT)] border border-sidebar-border bg-sidebar px-2 py-1.5 text-[11px] text-white [color-scheme:dark] focus:border-primary/50 focus:shadow-[0_0_0_2px_rgba(29,158,117,0.2)] focus:ring-0",
        hasError && formControlErrorClassName,
        className,
      )}
      {...props}
    />
  );
}
