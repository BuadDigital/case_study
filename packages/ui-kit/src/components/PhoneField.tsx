import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type PhoneFieldProps = {
  label: ReactNode;
  children: ReactNode;
  /**
   * `label` when the field wraps a single input/select, so tapping the caption focuses it.
   * Keep the default `div` around button groups or several controls.
   * @default "div"
   */
  as?: "div" | "label";
  className?: string;
};

/** Phone field: a small caption above a full-width control. */
export function PhoneField({ label, children, as: Root = "div", className }: PhoneFieldProps) {
  return (
    <Root className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-[11px] font-medium text-text-3">{label}</span>
      {children}
    </Root>
  );
}
