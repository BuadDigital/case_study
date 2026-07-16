import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "../lib/cn";
import {
  operationalToolbarPrimaryButtonClassName,
  operationalToolbarSearchInputClassName,
  operationalToolbarSearchWrapClassName,
  operationalToolbarSelectCaretClassName,
  operationalToolbarSelectClassName,
  operationalToolbarSelectWrapClassName,
} from "../lib/operational-toolbar-classes";

function SearchGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function CaretGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function OperationalToolbarSearch({
  className,
  inputClassName,
  startAdornment,
  endAdornment,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  inputClassName?: string;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
}) {
  return (
    <div className={cn(operationalToolbarSearchWrapClassName, className)}>
      <span className="pointer-events-none absolute inset-inline-start-3 top-1/2 -translate-y-1/2 text-text-3">
        <SearchGlyph />
      </span>
      {startAdornment}
      <input
        className={cn(
          operationalToolbarSearchInputClassName,
          "ps-9",
          endAdornment ? "pe-[6.25rem]" : null,
          inputClassName,
        )}
        {...props}
      />
      {endAdornment}
    </div>
  );
}

export function OperationalToolbarSelect({
  className,
  selectClassName,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  selectClassName?: string;
}) {
  return (
    <div className={cn(operationalToolbarSelectWrapClassName, className)}>
      <select
        className={cn(operationalToolbarSelectClassName, selectClassName)}
        {...props}
      >
        {children}
      </select>
      <span className={operationalToolbarSelectCaretClassName}>
        <CaretGlyph />
      </span>
    </div>
  );
}

export function OperationalToolbarPrimaryButton({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(operationalToolbarPrimaryButtonClassName, className)}
      {...props}
    >
      {children}
    </button>
  );
}

export {
  operationalToolbarPrimaryButtonClassName,
  operationalToolbarSearchInputClassName,
  operationalToolbarSearchWrapClassName,
  operationalToolbarSelectCaretClassName,
  operationalToolbarSelectClassName,
  operationalToolbarSelectWrapClassName,
} from "../lib/operational-toolbar-classes";
