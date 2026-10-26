"use client";

import {
  transactionDeedDateOf,
  transactionDeedLabelOf,
  type TransactionDeedDto,
} from "@platform/api-client";
import { fmtMax, parseLocaleNumber } from "@platform/app-shared/format/number";
import { MobileRecordCard, MobileRecordList } from "@platform/ui-kit";
import { ValCard } from "./EvaluatorHtmlPrimitives";

/**
 * The total area of a linked property's deeds, as printed under the deeds table.
 *
 * How it works: parses each deed's `area` with `parseLocaleNumber` (so "1,250" and Arabic
 * digits such as "٧٥٠٫٥" both read), sums them and formats the sum with up to two decimals
 * plus " م²".
 *
 * Edge cases: any deed without a readable area (null, empty, text) → "—" rather than a partial
 * total that would understate the property; an empty list → "—".
 */
export function linkedDeedsTotalArea(deeds: readonly Pick<TransactionDeedDto, "area">[]): string {
  const areas = deeds.map((d) => parseLocaleNumber(d.area ?? ""));
  return areas.length > 0 && areas.every((a) => Number.isFinite(a))
    ? `${fmtMax(areas.reduce((sum, a) => sum + a, 0), 2)} م²`
    : "—";
}

/**
 * The «صكوك العقار» card on the appraiser's basic screen for a linked property.
 *
 * How it works: phase 5 (decision 2026-10-19) — a linked property is valued as one, so the
 * appraiser sees every deed of the transaction above the documents. Takes the live `deeds`
 * (from `linkedPropertyDeeds`), the link kind label and the transaction number; prints a note
 * («عقار مرتبط — kind · المعاملة number»), then one row per deed: label
 * (`transactionDeedLabelOf`, registry number for a registry deed), date
 * (`transactionDeedDateOf`), work order and area, and a total-area row
 * (`linkedDeedsTotalArea`). Phones get one card per deed instead of the table.
 *
 * Edge cases: fewer than two deeds → renders nothing (an ordinary one-deed property); no link
 * kind or no transaction number → that part of the note is left out; a missing date/area → "—".
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
      {/* Phones: a card per deed + the total — five fixed columns clipped the deed numbers. */}
      <MobileRecordList className="lg:hidden">
        {deeds.map((d, i) => (
          <MobileRecordCard
            key={d.propertyId}
            title={
              <>
                <span className="me-1.5 text-text-3">{i + 1}.</span>
                <bdi dir="ltr">{transactionDeedLabelOf(d)}</bdi>
              </>
            }
            fields={[
              { label: "تاريخه", value: transactionDeedDateOf(d) || "—", ltr: true },
              { label: "أمر العمل", value: d.poNumber, ltr: true },
              { label: "المساحة", value: d.area?.trim() || "—", ltr: true },
            ]}
          />
        ))}
        <div className="flex items-center justify-between gap-3 rounded-[12px] bg-surface-2 px-4 py-3 text-[12.5px] font-bold text-heading">
          <span>المساحة الكلية</span>
          <bdi dir="ltr">{linkedDeedsTotalArea(deeds)}</bdi>
        </div>
      </MobileRecordList>
      <table className="w-full table-fixed border-collapse overflow-hidden rounded-[10px] border border-border max-lg:hidden">
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
