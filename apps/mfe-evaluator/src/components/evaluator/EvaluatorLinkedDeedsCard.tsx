"use client";

import {
  transactionDeedDateOf,
  transactionDeedLabelOf,
  type TransactionDeedDto,
} from "@platform/api-client";
import { fmtMax, parseLocaleNumber } from "@platform/app-shared/format/number";
import { ValCard } from "./EvaluatorHtmlPrimitives";

/** Sum of the deed areas in m², or "—" when any deed has none. */
export function linkedDeedsTotalArea(deeds: readonly Pick<TransactionDeedDto, "area">[]): string {
  const areas = deeds.map((d) => parseLocaleNumber(d.area ?? ""));
  return areas.length > 0 && areas.every((a) => Number.isFinite(a))
    ? `${fmtMax(areas.reduce((sum, a) => sum + a, 0), 2)} م²`
    : "—";
}

/**
 * Phase 5 (decision 2026-10-19): a linked property is valued as one — the appraiser sees every
 * deed of the transaction, its area and the total, above the documents.
 */
export function EvaluatorLinkedDeedsCard({
  deeds,
  linkKindLabel,
  transactionNumber,
}: {
  deeds: readonly TransactionDeedDto[];
  linkKindLabel?: string | null;
  transactionNumber?: string | null;
}) {
  if (deeds.length < 2) return null;
  return (
    <ValCard title={`صكوك العقار (${deeds.length})`}>
      <p className="-mt-1 mb-2.5 text-[11.5px] text-text-3">
        عقار مرتبط{linkKindLabel ? ` — ${linkKindLabel}` : ""}
        {transactionNumber ? (
          <>
            {" · المعاملة "}
            <span dir="ltr">{transactionNumber}</span>
          </>
        ) : null}
        . يُقيَّم العقار كاملاً بتقرير واحد يذكر كل الصكوك.
      </p>
      <table className="w-full table-fixed border-collapse overflow-hidden rounded-[10px] border border-border">
        <thead>
          <tr>
            <th className="w-8 border-b border-border bg-surface-2 px-2 py-2 text-center text-[11px] font-bold text-text-2">#</th>
            <th className="border-b border-border bg-surface-2 px-3 py-2 text-right text-[11px] font-bold text-text-2">الصك / السجل</th>
            <th className="border-b border-border bg-surface-2 px-3 py-2 text-right text-[11px] font-bold text-text-2">تاريخه</th>
            <th className="border-b border-border bg-surface-2 px-3 py-2 text-right text-[11px] font-bold text-text-2">أمر العمل</th>
            <th className="w-28 border-b border-border bg-surface-2 px-3 py-2 text-right text-[11px] font-bold text-text-2">المساحة</th>
          </tr>
        </thead>
        <tbody>
          {deeds.map((d, i) => (
            <tr key={d.propertyId}>
              <td className="border-b border-border px-2 py-1.5 text-center text-xs text-text-3">{i + 1}</td>
              <td className="border-b border-border px-3 py-1.5 text-xs font-semibold text-heading" dir="ltr">
                {transactionDeedLabelOf(d)}
              </td>
              <td className="border-b border-border px-3 py-1.5 text-xs text-text-2" dir="ltr">
                {transactionDeedDateOf(d) || "—"}
              </td>
              <td className="border-b border-border px-3 py-1.5 text-xs text-text-2" dir="ltr">{d.poNumber}</td>
              <td className="border-b border-border px-3 py-1.5 text-xs text-text" dir="ltr">{d.area?.trim() || "—"}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} className="bg-surface-2 px-3 py-1.5 text-end text-[11px] font-bold text-heading">
              المساحة الكلية
            </td>
            <td className="bg-surface-2 px-3 py-1.5 text-xs font-bold text-heading" dir="ltr">
              {linkedDeedsTotalArea(deeds)}
            </td>
          </tr>
        </tbody>
      </table>
    </ValCard>
  );
}
