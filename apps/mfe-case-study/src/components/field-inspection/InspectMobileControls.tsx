"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@platform/design-system";

/** Case Study.html `lbl` — field caption on mobile inspect form. */
export function MobileFieldLabel({
  children,
  shared,
}: {
  children: ReactNode;
  shared?: boolean;
}) {
  return (
    <div className="mb-2 text-[13px] font-bold text-heading">
      {children}
      {shared ? (
        <span className="ms-1.5 text-[11px] font-bold text-[#8b5cf6]">
          مشترك
        </span>
      ) : null}
    </div>
  );
}

/** Case Study.html `pills` — single-select rounded pills. */
export function MobilePills({
  options,
  value,
  disabled,
  onChange,
}: {
  options: readonly string[];
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const on = opt === value;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            className={cn(
              "min-h-11 rounded-full border-[1.5px] px-4 py-2.5 font-inherit text-[14px] font-semibold",
              on
                ? "border-ink bg-ink text-white"
                : "border-[var(--border-md,#ddd8cc)] bg-surface text-text-2",
            )}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/** Case Study.html `chips` — multi-select teal chips. */
export function MobileChips({
  options,
  selected,
  disabled,
  onChange,
}: {
  options: readonly string[];
  selected: readonly string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-xl border-[1.5px] px-[15px] py-2.5 font-inherit text-[14px] font-semibold",
              on
                ? "border-[color-mix(in_srgb,#2a8f8f_45%,transparent)] bg-[color-mix(in_srgb,#2a8f8f_12%,transparent)] text-[#1f6f6f]"
                : "border-[var(--border-md,#ddd8cc)] bg-surface text-text-2",
            )}
            onClick={() => {
              onChange(
                on ? selected.filter((x) => x !== opt) : [...selected, opt],
              );
            }}
          >
            {on ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : null}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

const FEATURE_SUGGESTIONS: Record<string, readonly string[]> = {
  assetSubject: ["فيلا", "شقة", "أرض"],
  propertyUsage: ["سكني", "تجاري"],
  facade: ["شمالية", "شرقية"],
};

/** Case Study.html `suggestRow` — quick picks above searchable select. */
export function MobileSuggestRow({
  fieldKey,
  value,
  disabled,
  onPick,
}: {
  fieldKey: string;
  value?: string;
  disabled?: boolean;
  onPick: (value: string) => void;
}) {
  const list = FEATURE_SUGGESTIONS[fieldKey];
  if (!list?.length) return null;
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[11px] text-text-3">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 3v2M5 8l1.5 1.5M19 8l-1.5 1.5M9 21h6M8 17a5 5 0 1 1 8 0c-.7.8-1 1.4-1 2H9c0-.6-.3-1.2-1-2Z" />
        </svg>
        الأكثر استخداماً
      </span>
      {list.map((op) => {
        const on = op === value;
        return (
          <button
            key={op}
            type="button"
            disabled={disabled}
            className={cn(
              "min-h-9 rounded-full border px-3.5 py-1.5 font-inherit text-[13px] font-semibold",
              on
                ? "border-solid border-[var(--gold-d,#a4906f)] bg-[var(--gold-d,#a4906f)] text-white"
                : "border-dashed border-[var(--gold-d,#a4906f)] bg-[color-mix(in_srgb,var(--gold)_9%,transparent)] text-[var(--gold-d,#a4906f)]",
            )}
            onClick={() => onPick(op)}
          >
            {op}
          </button>
        );
      })}
    </div>
  );
}

/** Case Study.html `msearch` — searchable single-select. */
export function MobileSearchSelect({
  options,
  value,
  disabled,
  onChange,
}: {
  options: readonly string[];
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return options;
    return options.filter((op) => op.includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border border-[var(--border-md,#ddd8cc)] bg-surface px-3.5 py-3 text-start font-inherit text-[15px] text-text"
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
          setQuery("");
          window.setTimeout(() => inputRef.current?.focus(), 30);
        }}
      >
        <span className={cn(!value && "text-text-3")}>
          {value || "— اختر —"}
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-text-3" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div className="absolute inset-inline-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded-xl border border-[var(--border-md,#ddd8cc)] bg-surface shadow-[0_12px_30px_-8px_rgba(16,43,78,0.28)]">
          <div className="border-b border-border p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث…"
              className="min-h-11 w-full rounded-[9px] border border-[var(--border-md,#ddd8cc)] bg-surface-2 px-3 py-2.5 font-inherit text-[14px] text-text outline-none"
            />
          </div>
          <div className="max-h-[210px] overflow-y-auto">
            {filtered.map((op) => (
              <button
                key={op}
                type="button"
                className={cn(
                  "min-h-[46px] w-full border-b border-border px-3.5 py-3 text-start font-inherit text-[14.5px]",
                  op === value
                    ? "bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] font-bold text-text"
                    : "bg-surface font-medium text-text",
                )}
                onClick={() => {
                  onChange(op);
                  setOpen(false);
                }}
              >
                {op}
              </button>
            ))}
            {filtered.length === 0 ? (
              <div className="p-3.5 text-center text-[13px] text-text-3">
                لا نتائج مطابقة
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const mobileControlClassName =
  "min-h-12 w-full rounded-xl border border-[var(--border-md,#ddd8cc)] bg-surface px-3.5 py-3 font-inherit text-[15px] text-text outline-none";

export function featureUsesPills(field: {
  key: string;
  options: readonly string[];
}): boolean {
  return field.key === "facade" || field.options.length <= 3;
}
