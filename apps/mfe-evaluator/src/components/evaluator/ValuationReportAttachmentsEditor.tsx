"use client";

import type { ValuationPrintAttachmentRow } from "../../lib/evaluator/valuation-report-property-attachments";

/** Checklist of report attachments — filled by the appraiser on final review. */
export function ValuationReportAttachmentsEditor({
  rows,
  selectedKeys,
  disabled = false,
  onChange,
}: {
  rows: ValuationPrintAttachmentRow[];
  selectedKeys: string[];
  disabled?: boolean;
  onChange: (keys: string[]) => void;
}) {
  const selected = new Set(selectedKeys);

  function toggleKey(key: string, next: boolean) {
    if (disabled) return;
    if (next) {
      if (selected.has(key)) return;
      onChange([...selectedKeys, key]);
      return;
    }
    onChange(selectedKeys.filter((k) => k !== key));
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const docHint = row.docs[0];
        return (
          <label
            key={row.key}
            className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius)] border border-border bg-surface-2 px-3 py-2.5 text-[12.5px] text-text"
          >
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-[var(--ink)] disabled:cursor-not-allowed"
              checked={selected.has(row.key)}
              disabled={disabled}
              onChange={(e) => toggleKey(row.key, e.target.checked)}
            />
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-heading">{row.name}</span>
              {row.isRequired ? (
                <span className="ms-2 text-[10.5px] font-medium text-gold-d">
                  إلزامي في القوائم
                </span>
              ) : null}
              <span className="mt-0.5 block text-[10.5px] leading-relaxed text-text-3">
                {row.available && docHint
                  ? `في مستندات العقار: ${docHint.name} · ${docHint.source}`
                  : "غير متوفر بعد في مستندات العقار"}
              </span>
            </span>
          </label>
        );
      })}
      {rows.length === 0 ? (
        <p className="m-0 text-[12px] text-text-3">لا توجد مرفقات معرفة بعد.</p>
      ) : null}
    </div>
  );
}
