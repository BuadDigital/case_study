"use client";

/** Inspection-tab field primitives — label/value, edit input, select, textarea, grid. */

import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@platform/ui-kit";
import { inspectorInvalidControlClass } from "../../lib/app-data/inspector-workspace-validation";
import { EDIT_CONTROL_CLASS } from "../field-inspection/FieldInspectionWorkParts";

const InsFieldsGridCenteredContext = createContext(false);

export function useInsFieldsGridCentered() {
  return useContext(InsFieldsGridCenteredContext);
}

export function insFieldLabelRowClass(centered: boolean) {
  return cn("mb-1 flex flex-wrap items-center gap-1.5", centered && "justify-center");
}

export function insFieldLabelClass(centered: boolean, invalid?: boolean) {
  return cn(
    "text-[11px] font-semibold",
    centered && "w-full text-center",
    invalid ? "text-danger" : "text-text-2",
  );
}

/** Case Study.html `insField` — plain label + value (no gold FieldBox). */
export function InsField({
  label,
  value,
  ltr,
  badge,
  className,
}: {
  label: string;
  value?: string;
  ltr?: boolean;
  badge?: ReactNode;
  className?: string;
}) {
  const gridCentered = useInsFieldsGridCentered();
  const trimmed = value?.trim() ?? "";
  return (
    <div className={cn("min-w-0", className)}>
      <div className={insFieldLabelRowClass(gridCentered)}>
        <span className={insFieldLabelClass(gridCentered)}>{label}</span>
        {badge}
      </div>
      <div
        className={cn(
          "py-0.5 text-[13px] font-semibold text-heading",
          ltr && "[direction:ltr] [unicode-bidi:isolate] text-center",
          !trimmed && "font-normal text-text-3",
        )}
      >
        {trimmed || "—"}
      </div>
    </div>
  );
}

/** Editable counterpart of `InsField` — used when the tab is in edit mode. */
export function InsEditField({
  id,
  label,
  value,
  onChange,
  ltr,
  badge,
  type = "text",
  inputMode,
  placeholder,
  className,
  invalid,
  errorMessage,
  disabled = false,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  ltr?: boolean;
  badge?: ReactNode;
  type?: string;
  inputMode?: "decimal" | "numeric" | "text" | "tel" | "email" | "url" | "search" | "none";
  placeholder?: string;
  className?: string;
  invalid?: boolean;
  errorMessage?: string;
  disabled?: boolean;
}) {
  const gridCentered = useInsFieldsGridCentered();
  const inputCenterClass =
    ltr || gridCentered ? "text-center [direction:ltr] [unicode-bidi:isolate]" : undefined;

  if (disabled) {
    return (
      <div className={cn("min-w-0", className)} id={id ? `${id}-wrap` : undefined}>
        <div className={insFieldLabelRowClass(gridCentered)}>
          <span className={insFieldLabelClass(gridCentered)}>{label}</span>
          {badge}
        </div>
        <input
          id={id}
          type={type}
          readOnly
          tabIndex={-1}
          aria-readonly="true"
          className={cn(
            EDIT_CONTROL_CLASS,
            inputCenterClass,
            "cursor-default font-semibold text-heading",
          )}
          value={value}
        />
      </div>
    );
  }
  return (
    <div className={cn("min-w-0", className)} id={id ? `${id}-wrap` : undefined}>
      <div className={insFieldLabelRowClass(gridCentered)}>
        <span className={insFieldLabelClass(gridCentered, invalid)}>
          {label}
        </span>
        {badge}
      </div>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        aria-invalid={invalid || undefined}
        className={cn(
          EDIT_CONTROL_CLASS,
          inputCenterClass,
          invalid && inspectorInvalidControlClass,
        )}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {invalid && errorMessage ? (
        <p className="mt-1 text-[11px] font-semibold text-danger" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export function InsEditSelect({
  id,
  label,
  value,
  options,
  onChange,
  badge,
  placeholder = "— اختر —",
  className,
}: {
  id?: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  badge?: ReactNode;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-text-2">{label}</span>
        {badge}
      </div>
      <select
        id={id}
        className={EDIT_CONTROL_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

export function InsEditTextarea({
  id,
  label,
  value,
  onChange,
  rows = 3,
  className,
  disabled = false,
  invalid,
  errorMessage,
  placeholder,
  hint,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  className?: string;
  disabled?: boolean;
  invalid?: boolean;
  errorMessage?: string;
  placeholder?: string;
  hint?: string;
}) {
  if (disabled) {
    return <InsField label={label} value={value} className={className} />;
  }
  return (
    <div className={cn("min-w-0", className)} id={id ? `${id}-wrap` : undefined}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "text-[11px] font-semibold",
            invalid ? "text-danger" : "text-text-2",
          )}
        >
          {label}
        </span>
      </div>
      {hint ? (
        <p id={id ? `${id}-hint` : undefined} className="mb-1.5 text-[11px] text-text-3">
          {hint}
        </p>
      ) : null}
      <textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        aria-describedby={
          [hint && id ? `${id}-hint` : null, invalid && errorMessage && id ? `${id}-error` : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={cn(EDIT_CONTROL_CLASS, "resize-y", invalid && inspectorInvalidControlClass)}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {invalid && errorMessage ? (
        <p id={id ? `${id}-error` : undefined} className="mt-1 mb-0 text-[11px] text-danger-text">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export function InsFieldsGrid({
  min = 150,
  centered = false,
  children,
}: {
  min?: number;
  centered?: boolean;
  children: ReactNode;
}) {
  return (
    <InsFieldsGridCenteredContext.Provider value={centered}>
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
        }}
      >
        {children}
      </div>
    </InsFieldsGridCenteredContext.Provider>
  );
}
