"use client";

import { cn, formControlClassName } from "@platform/design-system";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/** تسمية عائمة على حد الحقل — مطابق لشكل حقول إنفاذ. */
export function InfathFloatLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="pointer-events-none absolute inset-inline-start-2.5 top-0 z-[1] -translate-y-1/2 bg-surface px-1 text-[11px] font-medium leading-none text-[#4b5563]"
    >
      {children}
      {required ? <span className="text-[#e11d48]">*</span> : null}
    </label>
  );
}

/** قيمة «كتابة» الزرقاء بجانب الحقل الرقمي — مطابق إنفاذ. */
export function InfathWordsValue({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-center gap-1 px-0.5 py-1",
        className,
      )}
    >
      <span className="text-[11px] font-medium leading-none text-[#6b7280]">
        {label}
      </span>
      <span className="text-[13px] font-semibold leading-snug text-[#185fa5]">
        {value}
      </span>
    </div>
  );
}

const fieldShell =
  "relative min-w-0 rounded-lg border border-[#d1d5db] bg-surface transition focus-within:border-[#94a3b8] focus-within:shadow-[0_0_0_3px_rgba(24,95,165,.12)]";

const controlClass =
  "h-11 w-full border-0 bg-transparent px-3 text-[13px] text-[#111827] outline-none shadow-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60";

export function InfathTextField({
  id,
  label,
  required,
  error,
  className,
  ...props
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className">) {
  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          fieldShell,
          "mt-2.5",
          error && "border-[#f87171] focus-within:border-[#ef4444]",
        )}
      >
        <InfathFloatLabel htmlFor={id} required={required}>
          {label}
        </InfathFloatLabel>
        <input
          id={id}
          className={cn(controlClass, "tabular-nums")}
          {...props}
        />
      </div>
      {error ? (
        <span className="mt-1 block text-[11px] text-danger-text">{error}</span>
      ) : null}
    </div>
  );
}

export function InfathSelectField({
  id,
  label,
  required,
  error,
  className,
  children,
  ...props
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "className">) {
  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          fieldShell,
          "mt-2.5",
          error && "border-[#f87171]",
        )}
      >
        <InfathFloatLabel htmlFor={id} required={required}>
          {label}
        </InfathFloatLabel>
        <select
          id={id}
          className={cn(controlClass, "cursor-pointer pe-8 appearance-none")}
          {...props}
        >
          {children}
        </select>
        <span
          className="pointer-events-none absolute inset-inline-end-3 top-1/2 -translate-y-1/2 text-[#6b7280]"
          aria-hidden
        >
          ▾
        </span>
      </div>
      {error ? (
        <span className="mt-1 block text-[11px] text-danger-text">{error}</span>
      ) : null}
    </div>
  );
}

export function InfathTextAreaField({
  id,
  label,
  required,
  error,
  className,
  ...props
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className">) {
  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          fieldShell,
          "mt-2.5",
          error && "border-[#f87171]",
        )}
      >
        <InfathFloatLabel htmlFor={id} required={required}>
          {label}
        </InfathFloatLabel>
        <textarea
          id={id}
          className={cn(
            formControlClassName,
            "min-h-[88px] w-full resize-y rounded-lg border-0 bg-transparent px-3 py-2.5 text-[13px] leading-relaxed shadow-none focus:ring-0",
          )}
          {...props}
        />
      </div>
      {error ? (
        <span className="mt-1 block text-[11px] text-danger-text">{error}</span>
      ) : null}
    </div>
  );
}

export function InfathReadOnlyBox({
  id,
  label,
  required,
  value,
  className,
}: {
  id?: string;
  label: string;
  required?: boolean;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className={cn(fieldShell, "mt-2.5")}>
        <InfathFloatLabel htmlFor={id} required={required}>
          {label}
        </InfathFloatLabel>
        <div
          id={id}
          className={cn(controlClass, "flex items-center tabular-nums")}
          aria-live="polite"
        >
          {value}
        </div>
      </div>
    </div>
  );
}

export function InfathSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <h4 className="m-0 mb-3 text-[13px] font-bold text-[#1f2937]">{title}</h4>
      {children}
    </section>
  );
}
