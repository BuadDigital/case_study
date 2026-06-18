"use client";

import {
  Input,
  Label,
  Select,
  Textarea,
  cn,
} from "@platform/design-system";
import type {
  DynamicScreenField,
  DynamicScreenFieldBinding,
  DynamicScreenFieldType,
} from "@platform/types";
import { LIST_LIKE_FIELD_TYPES } from "../field-type-labels";

type Props = {
  field: DynamicScreenField;
  binding: DynamicScreenFieldBinding;
  value: unknown;
  readOnly?: boolean;
  onChange?: (value: unknown) => void;
};

function isViewMode(binding: DynamicScreenFieldBinding, readOnly?: boolean): boolean {
  return readOnly || binding.mode === "view";
}

function renderControl(
  field: DynamicScreenField,
  type: DynamicScreenFieldType,
  value: unknown,
  disabled: boolean,
  onChange?: (value: unknown) => void,
) {
  const stringValue = value == null ? "" : String(value);

  if (LIST_LIKE_FIELD_TYPES.includes(type)) {
    if (type === "checkbox" && field.options && field.options.length > 0) {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-1">
          {field.options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 text-sm text-text"
            >
              <input
                type="checkbox"
                checked={selected.includes(option)}
                disabled={disabled}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...selected, option]
                    : selected.filter((item) => item !== option);
                  onChange?.(next);
                }}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      );
    }

    if (type === "radio" && field.options) {
      return (
        <div className="space-y-1">
          {field.options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 text-sm text-text"
            >
              <input
                type="radio"
                name={field.id}
                checked={stringValue === option}
                disabled={disabled}
                onChange={() => onChange?.(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      );
    }

    if (type === "multiselect") {
      return (
        <Select
          multiple
          value={Array.isArray(value) ? (value as string[]) : []}
          disabled={disabled}
          onChange={(event) => {
            const selected = Array.from(event.target.selectedOptions).map(
              (option) => option.value,
            );
            onChange?.(selected);
          }}
        >
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      );
    }

    return (
      <Select
        value={stringValue}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
      >
        <option value="">— اختر —</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    );
  }

  switch (type) {
    case "textarea":
    case "richtext":
      return (
        <Textarea
          rows={3}
          value={stringValue}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value)}
        />
      );
    case "bool":
      return (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(event) => onChange?.(event.target.checked)}
          />
          <span>نعم</span>
        </label>
      );
    case "number":
    case "decimal":
    case "currency":
    case "percent":
      return (
        <Input
          type="number"
          value={stringValue}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value)}
        />
      );
    case "date":
      return (
        <Input
          type="date"
          value={stringValue}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value)}
        />
      );
    case "time":
      return (
        <Input
          type="time"
          value={stringValue}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value)}
        />
      );
    case "datetime":
      return (
        <Input
          type="datetime-local"
          value={stringValue}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value)}
        />
      );
    case "email":
      return (
        <Input
          type="email"
          value={stringValue}
          placeholder={field.placeholder ?? "name@example.com"}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value)}
        />
      );
    case "phone":
      return (
        <Input
          type="tel"
          value={stringValue}
          placeholder={field.placeholder ?? "05xxxxxxxx"}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value)}
        />
      );
    case "url":
      return (
        <Input
          type="url"
          value={stringValue}
          placeholder={field.placeholder ?? "https://"}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value)}
        />
      );
    case "color":
      return (
        <Input
          type="color"
          value={stringValue || "#000000"}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value)}
        />
      );
    case "file":
    case "image":
    case "signature":
      return (
        <Input
          type="file"
          disabled={disabled}
          accept={type === "image" ? "image/*" : undefined}
          onChange={(event) => onChange?.(event.target.files?.[0]?.name ?? "")}
        />
      );
    case "rating":
      return (
        <Input
          type="number"
          min={1}
          max={5}
          value={stringValue}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value)}
        />
      );
    case "autonum":
      return (
        <Input value={stringValue} disabled readOnly placeholder="يُولَّد تلقائياً" />
      );
    default:
      return (
        <Input
          type="text"
          value={stringValue}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value)}
        />
      );
  }
}

export function FieldControl({
  field,
  binding,
  value,
  readOnly,
  onChange,
}: Props) {
  const view = isViewMode(binding, readOnly);
  const required = binding.mode === "input" && binding.required;

  return (
    <div className="min-w-0">
      <Label className="mb-1.5 block text-sm font-medium text-text">
        {field.name}
        {required ? <span className="text-danger"> *</span> : null}
        {view ? (
          <span className="ms-2 rounded bg-surface-2 px-2 py-0.5 text-[10px] font-normal text-text-3">
            عرض
          </span>
        ) : null}
      </Label>
      {view ? (
        <div
          className={cn(
            "rounded border border-border bg-surface-2 px-3 py-2 text-sm text-text-3",
          )}
        >
          {value == null || value === ""
            ? "— تُملأ من خطوة سابقة —"
            : Array.isArray(value)
              ? value.join("، ")
              : String(value)}
        </div>
      ) : (
        renderControl(field, field.type, value, false, onChange)
      )}
    </div>
  );
}
