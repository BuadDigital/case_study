"use client";

import { Input, Label, Select, Textarea, cn } from "@platform/design-system";

function FieldWrap({
  label,
  required,
  className,
  error,
  hint,
  fieldId,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  error?: string;
  hint?: string;
  fieldId?: string;
  children: React.ReactNode;
}) {
  const hintId = hint && fieldId ? `${fieldId}-hint` : undefined;
  return (
    <div className={className}>
      <Label htmlFor={fieldId} className="mb-1 text-[11px] font-semibold text-text-2">
        {label}
        {required ? <span className="text-danger-text"> *</span> : null}
      </Label>
      {children}
      {hint ? (
        <p className="mt-1 text-[10px] text-text-3" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          className="mt-1 text-[10px] text-danger-text"
          role="alert"
          id={fieldId ? `${fieldId}-error` : undefined}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RegField({
  id,
  label,
  required,
  type = "text",
  placeholder,
  inputMode,
  value,
  onChange,
  className,
  dir,
  error,
  hint,
  maxLength,
}: {
  id: string;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  dir?: "ltr" | "rtl";
  error?: string;
  hint?: string;
  maxLength?: number;
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <FieldWrap
      label={label}
      required={required}
      className={className}
      error={error}
      hint={hint}
      fieldId={id}
    >
      <Input
        id={id}
        hasError={Boolean(error)}
        type={type}
        placeholder={placeholder}
        inputMode={inputMode}
        value={value}
        dir={dir}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="text-xs"
      />
    </FieldWrap>
  );
}

export type RegSelectOption = string | { value: string; label: string };

function regSelectEntries(
  options: readonly RegSelectOption[],
): { value: string; label: string }[] {
  return options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
}

export function RegTextarea({
  id,
  label,
  required,
  placeholder,
  value,
  onChange,
  className,
  error,
  hint,
  rows = 4,
}: {
  id: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  error?: string;
  hint?: string;
  rows?: number;
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <FieldWrap
      label={label}
      required={required}
      className={className}
      error={error}
      hint={hint}
      fieldId={id}
    >
      <Textarea
        id={id}
        hasError={Boolean(error)}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="text-xs"
      />
    </FieldWrap>
  );
}

export function RegSelect({
  id,
  label,
  required,
  options,
  value,
  onChange,
  className,
  error,
  disabled,
  placeholder,
}: {
  id: string;
  label: string;
  required?: boolean;
  options: readonly RegSelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const entries = regSelectEntries(options);
  return (
    <FieldWrap label={label} required={required} className={className} error={error}>
      <Select
        id={id}
        hasError={Boolean(error)}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className="text-xs disabled:cursor-not-allowed disabled:opacity-65"
      >
        <option value="">{placeholder ?? "اختر..."}</option>
        {entries.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </FieldWrap>
  );
}
