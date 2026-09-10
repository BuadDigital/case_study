"use client";

import { cn } from "@platform/ui-kit";
import type { ValuationPrintAttachmentRow } from "../../lib/evaluator/valuation-report-property-attachments";
import { movePrintAttachmentKey } from "../../lib/evaluator/valuation-report-property-attachments";

/** Checklist + row reorder for report attachments (final review). */
export function ValuationReportAttachmentsEditor({
  rows,
  selectedKeys,
  orderKeys,
  disabled = false,
  onChange,
}: {
  rows: ValuationPrintAttachmentRow[];
  selectedKeys: string[];
  /** Full row order (selected + unselected). */
  orderKeys: string[];
  disabled?: boolean;
  onChange: (next: {
    printAttachmentKeys: string[];
    printAttachmentOrder: string[];
  }) => void;
}) {
  const selected = new Set(selectedKeys);
  const byKey = new Map(rows.map((row) => [row.key, row]));

  const orderedRows = [
    ...orderKeys
      .map((key) => byKey.get(key))
      .filter((row): row is ValuationPrintAttachmentRow => Boolean(row)),
    ...rows.filter((row) => !orderKeys.includes(row.key)),
  ];

  const effectiveOrder = orderedRows.map((row) => row.key);

  function toggleKey(key: string, next: boolean) {
    if (disabled) return;
    if (next) {
      if (selected.has(key)) return;
      onChange({
        printAttachmentKeys: [...selectedKeys, key],
        printAttachmentOrder: effectiveOrder,
      });
      return;
    }
    onChange({
      printAttachmentKeys: selectedKeys.filter((k) => k !== key),
      printAttachmentOrder: effectiveOrder,
    });
  }

  function moveRow(key: string, direction: -1 | 1) {
    if (disabled) return;
    onChange({
      printAttachmentKeys: selectedKeys,
      printAttachmentOrder: movePrintAttachmentKey(
        effectiveOrder,
        key,
        direction,
      ),
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {orderedRows.map((row, index) => {
        const docHint = row.docs[0];
        const isOn = selected.has(row.key);
        return (
          <div
            key={row.key}
            className={cn(
              "flex items-start gap-2.5 rounded-[var(--radius)] border border-border bg-surface-2 px-3 py-2.5 text-[12.5px] text-text",
              isOn && "border-border-md bg-surface",
            )}
          >
            <div className="flex shrink-0 flex-col gap-1 pt-0.5">
              <button
                type="button"
                className="min-w-[28px] rounded border border-border bg-surface px-2 py-0.5 text-[12px] font-bold text-heading disabled:cursor-not-allowed disabled:opacity-35"
                disabled={disabled || index === 0}
                aria-label={`تحريك ${row.name} لأعلى`}
                onClick={() => moveRow(row.key, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="min-w-[28px] rounded border border-border bg-surface px-2 py-0.5 text-[12px] font-bold text-heading disabled:cursor-not-allowed disabled:opacity-35"
                disabled={disabled || index >= orderedRows.length - 1}
                aria-label={`تحريك ${row.name} لأسفل`}
                onClick={() => moveRow(row.key, 1)}
              >
                ↓
              </button>
            </div>
            <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-[var(--ink)] disabled:cursor-not-allowed"
                checked={isOn}
                disabled={disabled}
                onChange={(e) => toggleKey(row.key, e.target.checked)}
              />
              <span className="min-w-0 flex-1 overflow-visible">
                <span className="font-semibold leading-snug text-heading">
                  {row.name}
                </span>
                <span className="mt-0.5 block text-[10.5px] leading-relaxed text-text-3">
                  {row.available && docHint
                    ? `في مستندات العقار: ${docHint.name} · ${docHint.source}`
                    : "غير متوفر بعد في مستندات العقار"}
                </span>
              </span>
            </label>
          </div>
        );
      })}
      {rows.length === 0 ? (
        <p className="m-0 text-[12px] text-text-3">لا توجد مرفقات معرفة بعد.</p>
      ) : null}
    </div>
  );
}
