"use client";

import type { CaseStudyReportDeeds } from "../../lib/app-data/case-study-report-document-model";
import { PROPERTY_IDENTIFIER_COLUMN_LABEL } from "../../lib/app-data/po-intake-data";

/**
 * Phase 4 (decision 2026-10-19): one study covers every deed of a linked property. The form
 * and the report tab show the deeds and the total area above the deed questions.
 */
export function CaseStudyDeedsTable({ deeds }: { deeds: CaseStudyReportDeeds }) {
  return (
    <div data-report-section>
      <div className="mb-2 flex flex-wrap items-center gap-2.5">
        <span className="h-[17px] w-[3px] rounded-full bg-gold" aria-hidden />
        <h3 className="m-0 text-[13px] font-extrabold text-heading">
          صكوك العقار ({deeds.rows.length})
        </h3>
        <span className="min-w-[1rem] flex-1 border-t border-border" aria-hidden />
        <span className="text-[11.5px] text-text-2">
          المساحة الكلية: <b className="text-heading" dir="ltr">{deeds.totalArea}</b>
        </span>
      </div>
      <table className="w-full table-fixed border-collapse overflow-hidden rounded-[10px] border border-border">
        <thead>
          <tr>
            <th className="w-10 border-b border-border bg-surface-2 px-2 py-2 text-center text-[11px] font-bold text-text-2">#</th>
            <th className="border-b border-border bg-surface-2 px-3 py-2 text-right text-[11px] font-bold text-text-2">
              {PROPERTY_IDENTIFIER_COLUMN_LABEL}
            </th>
            <th className="border-b border-border bg-surface-2 px-3 py-2 text-right text-[11px] font-bold text-text-2">أمر العمل</th>
            <th className="w-32 border-b border-border bg-surface-2 px-3 py-2 text-right text-[11px] font-bold text-text-2">المساحة</th>
          </tr>
        </thead>
        <tbody>
          {deeds.rows.map((d, i) => (
            <tr key={d.propertyId}>
              <td className="border-b border-border px-2 py-1.5 text-center text-xs text-text-3">{i + 1}</td>
              <td className="border-b border-border px-3 py-1.5 text-xs font-semibold text-heading" dir="ltr">
                {d.label}
              </td>
              <td className="border-b border-border px-3 py-1.5 text-xs text-text-2" dir="ltr">{d.poNumber}</td>
              <td className="border-b border-border px-3 py-1.5 text-xs text-text" dir="ltr">{d.area}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
