import type { ReactNode } from "react";
import { Label, type LabelProps } from "./Label";
import { cn } from "../lib/cn";

export type FormFieldProps = {
  id?: string;
  label?: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
  labelProps?: Omit<LabelProps, "children" | "htmlFor">;
};

export function FormField({
  id,
  label,
  error,
  hint,
  required,
  children,
  className,
  labelProps,
}: FormFieldProps) {
  return (
    <div className={cn("mb-3.5", className)}>
      {label ? (
        <Label htmlFor={id} {...labelProps}>
          {label}
          {required ? (
            <span className="ms-1 text-danger-text" aria-hidden>
              *
            </span>
          ) : null}
        </Label>
      ) : null}
      {children}
      {hint && !error ? (
        <p className="mt-1 text-xs text-text-3">{hint}</p>
      ) : null}
      {error ? (
        <p className="mt-1 text-xs text-danger-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
