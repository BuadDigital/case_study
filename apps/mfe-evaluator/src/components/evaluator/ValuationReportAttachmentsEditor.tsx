"use client";

import { cn } from "@platform/ui-kit";
import type { PropertyDetailDocumentEntry } from "@platform/app-shared/app-data/property-detail-document-types";
import { downloadDocumentFile } from "@platform/app-shared/app-data/download-document-file";
import type { ValuationPrintAttachmentRow } from "../../lib/evaluator/valuation-report-property-attachments";
import { movePrintAttachmentKey } from "../../lib/evaluator/valuation-report-property-attachments";

/**
 * The property documents behind a report attachment, read-only: they are uploaded and typed in
 * the property's «مستندات العقار» tab, never from the valuer's screen.
 */
function PropertyDocumentLinks({ docs }: { docs: PropertyDetailDocumentEntry[] }) {
  if (docs.length === 0) {
    return (
      <span className="mt-0.5 block text-[10.5px] leading-relaxed text-text-3">
        غير متوفر بعد في مستندات العقار
      </span>
    );
  }
  return (
    <span className="mt-1 flex flex-col gap-1">
      {docs.map((doc) => (
        <span
          key={doc.id}
          className="flex items-center justify-between gap-2 text-[10.5px] leading-relaxed text-text-3"
        >
          <span className="min-w-0 truncate">
            في مستندات العقار: {doc.name} · {doc.source}
          </span>
          <button
            type="button"
            className="shrink-0 rounded border border-border bg-surface px-2 py-0.5 text-[10.5px] font-bold text-text-2"
            onClick={() =>
              void downloadDocumentFile({
                fileName: doc.fileName,
                dataUrl: doc.dataUrl,
                attachmentId: doc.attachmentId ?? doc.inspectionPhoto?.attachment.attachmentId,
              })
            }
          >
            تنزيل
          </button>
        </span>
      ))}
    </span>
  );
}

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
  /** Full order of the printable rows (selected + unselected). */
  orderKeys: string[];
  disabled?: boolean;
  onChange: (next: {
    printAttachmentKeys: string[];
    printAttachmentOrder: string[];
  }) => void;
}) {
  const selected = new Set(selectedKeys);
  const printableRows = rows.filter((row) => row.printable);
  const referenceRows = rows.filter((row) => !row.printable);
  const byKey = new Map(printableRows.map((row) => [row.key, row]));

  const orderedRows = [
    ...orderKeys
      .map((key) => byKey.get(key))
      .filter((row): row is ValuationPrintAttachmentRow => Boolean(row)),
    ...printableRows.filter((row) => !orderKeys.includes(row.key)),
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
            <div className="min-w-0 flex-1">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-[var(--ink)] disabled:cursor-not-allowed"
                  checked={isOn}
                  disabled={disabled}
                  onChange={(e) => toggleKey(row.key, e.target.checked)}
                />
                <span className="font-semibold leading-snug text-heading">
                  {row.name}
                </span>
              </label>
              <div className="ps-[26px]">
                <PropertyDocumentLinks docs={row.docs} />
              </div>
            </div>
          </div>
        );
      })}
      {printableRows.length === 0 ? (
        <p className="m-0 text-[12px] text-text-3">لا توجد مرفقات معرفة بعد.</p>
      ) : null}

      {referenceRows.length > 0 ? (
        <div className="mt-1 flex flex-col gap-2">
          <p className="m-0 text-[11px] font-bold text-text-2">
            مستندات أخرى على العقار — للاطلاع فقط، لا تُطبع في التقرير
          </p>
          {referenceRows.map((row) => (
            <div
              key={row.key}
              className="rounded-[var(--radius)] border border-dashed border-border bg-surface-2 px-3 py-2.5 text-[12.5px] text-text"
            >
              <span className="font-semibold leading-snug text-heading">{row.name}</span>
              <PropertyDocumentLinks docs={row.docs} />
            </div>
          ))}
        </div>
      ) : null}

      <p className="m-0 text-[10.5px] leading-relaxed text-text-3">
        المستندات تُرفع وتُعرَّف بنوعها من تبويب «مستندات العقار» في صفحة العقار، وتظهر هنا
        للقراءة فقط.
      </p>
    </div>
  );
}
