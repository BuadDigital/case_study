"use client";

/**
 * The document-type choice inside the upload / classify dialog: the defined list, grouped, as
 * an in-dialog scrollable radio list. A native `<select>` with option groups opened as the
 * browser's own oversized popup over the dialog (reported 2026-10-18); this keeps the list
 * inside the dialog, right-to-left, with the chosen type marked.
 */

import { useEffect, useRef } from "react";
import { cn } from "@platform/ui-kit";
import type { PropertyDocumentTypeOption } from "../../lib/app-data/property-document-checklist";

export function PropertyDocumentTypePicker({
  id,
  options,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  options: PropertyDocumentTypeOption[];
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const groupTitles = [...new Set(options.map((o) => o.groupTitle))];

  // A dialog opened on a known type (from a checklist row) shows that type in view.
  useEffect(() => {
    if (!value) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-type-key="${CSS.escape(value)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [value]);

  return (
    <div
      id={id}
      ref={listRef}
      role="radiogroup"
      aria-label="نوع المستند"
      className="max-h-[280px] overflow-y-auto rounded-lg border border-border bg-surface"
    >
      {groupTitles.map((title) => (
        <div key={title}>
          <div className="sticky top-0 z-[1] border-b border-border bg-surface-2 px-3 py-1.5 text-[11px] font-bold text-text-3">
            {title}
          </div>
          {options
            .filter((o) => o.groupTitle === title)
            .map((o) => {
              const selected = o.key === value;
              return (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-type-key={o.key}
                  disabled={disabled}
                  onClick={() => onChange(o.key)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 border-b border-border/60 px-3 py-2 text-right text-[12.5px] text-heading transition-colors last:border-b-0",
                    "hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none",
                    selected &&
                      "bg-[color-mix(in_srgb,var(--gold)_14%,var(--surface))] font-semibold",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <span>{o.label}</span>
                  {selected ? (
                    <span aria-hidden className="text-[12px] text-gold">
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
        </div>
      ))}
    </div>
  );
}
