"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
} from "react";
import { Input, cn } from "@platform/design-system";

export type RegSearchSelectOption = {
  value: string;
  label: string;
};

type Props = {
  id: string;
  label: string;
  required?: boolean;
  options: readonly RegSearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  /** فلترة/ترتيب مخصّص؛ الافتراضي includes على العنوان. */
  filterOptions?: (
    options: readonly RegSearchSelectOption[],
    query: string,
  ) => RegSearchSelectOption[];
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
};

export function RegSearchSelect({
  id,
  label,
  required,
  options,
  value,
  onChange,
  className,
  error,
  disabled,
  placeholder = "ابحث…",
  hint,
  filterOptions,
  inputMode,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const selectedLabel = useMemo(() => {
    const hit = options.find((o) => o.value === value);
    return hit?.label ?? "";
  }, [options, value]);

  const filtered = useMemo(() => {
    if (filterOptions) return filterOptions(options, query);
    const q = query.trim().toLowerCase();
    if (!q) return [...options];
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [filterOptions, options, query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open, value]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = useCallback(
    (next: string) => {
      onChange(next);
      setOpen(false);
      setQuery("");
    },
    [onChange],
  );

  const showValue = open ? query : selectedLabel;

  return (
    <div className={className} ref={rootRef}>
      <label
        htmlFor={id}
        className="mb-1 block text-[11px] font-semibold text-text-2"
      >
        {label}
        {required ? <span className="text-danger-text"> *</span> : null}
      </label>
      <div className="relative">
        <Input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          hasError={Boolean(error)}
          disabled={disabled}
          placeholder={placeholder}
          value={showValue}
          inputMode={inputMode}
          autoComplete="off"
          className="text-xs"
          onFocus={() => {
            if (disabled) return;
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlight((h) =>
                filtered.length === 0 ? 0 : Math.min(h + 1, filtered.length - 1),
              );
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              if (open && filtered[highlight]) {
                e.preventDefault();
                pick(filtered[highlight]!.value);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
          }}
        />
        {open && !disabled ? (
          <ul
            id={listId}
            role="listbox"
            className={cn(
              "absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-[var(--radius-DEFAULT)]",
              "border border-border bg-surface py-1 shadow-md",
            )}
          >
            {filtered.length === 0 ? (
              <li className="px-2.5 py-2 text-[11px] text-text-3">لا نتائج</li>
            ) : (
              filtered.map((opt, i) => (
                <li key={opt.value} role="option" aria-selected={opt.value === value}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full px-2.5 py-1.5 text-start text-xs text-text",
                      i === highlight || opt.value === value
                        ? "bg-surface-2 font-semibold"
                        : "hover:bg-surface-2",
                    )}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(opt.value)}
                  >
                    {opt.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      {hint ? (
        <p className="mt-1 text-[10px] text-text-3" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 text-[10px] text-danger-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
