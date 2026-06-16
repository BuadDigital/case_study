import type { TextareaHTMLAttributes } from "react";
import { cn } from "../lib/cn";
import {
  formControlClassName,
  formControlErrorClassName,
} from "../lib/form-control-classes";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  hasError?: boolean;
};

export function Textarea({ className, hasError, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        formControlClassName,
        "min-h-[70px] resize-y py-2 leading-relaxed",
        hasError && formControlErrorClassName,
        className,
      )}
      {...props}
    />
  );
}
