import type { InputHTMLAttributes } from "react";
import { cn } from "../lib/cn";
import {
  formControlClassName,
  formControlErrorClassName,
} from "../lib/form-control-classes";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
};

export function Input({ className, hasError, ...props }: InputProps) {
  return (
    <input
      className={cn(
        formControlClassName,
        "h-[38px] py-0 leading-[38px]",
        hasError && formControlErrorClassName,
        className,
      )}
      {...props}
    />
  );
}
