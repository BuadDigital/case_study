import type { InputHTMLAttributes } from "react";
import { cn } from "../lib/cn";
import {
  formControlClassName,
  formControlErrorClassName,
} from "../lib/form-control-classes";
import {
  applyIsoDateToInput,
  parsePastedDate,
} from "../lib/pasted-date";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
};

export function Input({ className, hasError, onPaste, type, ...props }: InputProps) {
  return (
    <input
      className={cn(
        formControlClassName,
        "h-[38px] py-0 leading-[38px]",
        hasError && formControlErrorClassName,
        className,
      )}
      type={type}
      onPaste={(e) => {
        if (type === "date") {
          const iso = parsePastedDate(e.clipboardData.getData("text"));
          if (iso) {
            e.preventDefault();
            applyIsoDateToInput(e.currentTarget, iso);
            return;
          }
        }
        onPaste?.(e);
      }}
      {...props}
    />
  );
}
