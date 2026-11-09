"use client";

/** Inspection-tab field primitives — label/value, edit input, select, textarea, grid. */

import { createContext, useContext, type ReactNode } from "react";
import {
  cn,
  formControlClassName,
  useWorkDensity,
  WORK_FORM_GRID_CLASS,
} from "@platform/ui-kit";
import { inspectorInvalidControlClass } from "../../lib/app-data/inspector-workspace-validation";
import { EDIT_CONTROL_CLASS } from "../field-inspection/FieldInspectionWorkParts";

const InsFieldsGridCenteredContext = createContext(false);

export function useInsFieldsGridCentered() {
  return useContext(InsFieldsGridCenteredContext);
}

/**
 * The edit control's chrome: the inspector's own (`EDIT_CONTROL_CLASS`), or — on the work page's new
 * layout (`FormDensityProvider value="work"`, Omar 2026-11-09) — the ui-kit control every other
 * form of the page uses (38px, 13px), so the page shows one control height.
 * Edge cases: a textarea keeps its auto height and resize handle.
 */
export function useInsControlClass(kind: "input" | "textarea" = "input"): string {
  const work = useWorkDensity();
  if (!work) return EDIT_CONTROL_CLASS;
  return kind === "textarea"
    ? cn(formControlClassName, "h-auto min-h-[62px] py-2 leading-relaxed")
    : formControlClassName;
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

/**
 * Read-view counterpart of the edit controls — label over a plain value with a hairline
 * underneath. Used wherever a field is locked so a view-only page never looks fillable.
 */
export function InsReadField({
  id,
  label,
  value,
  ltr,
  badge,
  multiline,
  className,
}: {
  id?: string;
  label: string;
  value?: string;
  ltr?: boolean;
  badge?: ReactNode;
  multiline?: boolean;
  className?: string;
}) {
  const gridCentered = useInsFieldsGridCentered();
  const work = useWorkDensity();
  const trimmed = value?.trim() ?? "";
  return (
    <div
      className={cn("min-w-0", multiline && work && "col-span-full", className)}
      id={id ? `${id}-wrap` : undefined}
    >
      <div className={insFieldLabelRowClass(gridCentered)}>
        <span className={insFieldLabelClass(gridCentered)}>{label}</span>
        {badge}
      </div>
      <div
        id={id}
        className={cn(
          "border-b border-border/70 pb-1.5 pt-0.5 text-[13px] font-semibold leading-relaxed text-heading",
          gridCentered && "text-center",
          multiline && "whitespace-pre-wrap break-words",
          !trimmed && "font-normal text-text-3",
        )}
      >
        {trimmed ? (
          ltr ? <bdi dir="ltr" className="tabular-nums">{trimmed}</bdi> : trimmed
        ) : (
          "—"
        )}
      </div>
    </div>
  );
}

/** `<input type=date|time>` values are ISO / 24h — show them the way the person reads them. */
function readViewValue(type: string, value: string): string {
  const v = value.trim();
  if (type === "date") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
  }
  if (type === "time") {
    const m = /^(\d{2}):(\d{2})/.exec(v);
    if (!m) return v;
    const h = Number(m[1]);
    return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
  }
  return v;
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
  const controlClass = useInsControlClass();
  const inputCenterClass =
    ltr || gridCentered ? "text-center [direction:ltr] [unicode-bidi:isolate]" : undefined;

  if (disabled) {
    return (
      <InsReadField
        id={id}
        label={label}
        value={readViewValue(type, value)}
        ltr={ltr || type === "date" || type === "time"}
        badge={badge}
        className={className}
      />
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
          controlClass,
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
  const controlClass = useInsControlClass();
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-text-2">{label}</span>
        {badge}
      </div>
      <select
        id={id}
        className={controlClass}
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
  const controlClass = useInsControlClass("textarea");
  const work = useWorkDensity();
  if (disabled) {
    return <InsReadField id={id} label={label} value={value} multiline className={className} />;
  }
  return (
    <div
      className={cn("min-w-0", work && "col-span-full", className)}
      id={id ? `${id}-wrap` : undefined}
    >
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
        className={cn(controlClass, "resize-y", invalid && inspectorInvalidControlClass)}
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

/**
 * The inspection cards' field grid.
 *
 * How it works: `auto-fit` columns of at least `min` px — or, on the work page's layout
 * (Omar 2026-11-09), the shared 1 → 2 → 3 → 4 ladder (`WORK_FORM_GRID_CLASS`), so every card of the
 * page lines its fields up in the same four columns instead of 2 to 7 depending on its field count.
 * Edge cases: the inspector's own screens never sit in that density, so they keep `auto-fit`.
 */
export function InsFieldsGrid({
  min = 150,
  centered = false,
  children,
}: {
  min?: number;
  centered?: boolean;
  children: ReactNode;
}) {
  const work = useWorkDensity();
  return (
    <InsFieldsGridCenteredContext.Provider value={centered}>
      {work ? (
        <div className={WORK_FORM_GRID_CLASS}>{children}</div>
      ) : (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
          }}
        >
          {children}
        </div>
      )}
    </InsFieldsGridCenteredContext.Provider>
  );
}
