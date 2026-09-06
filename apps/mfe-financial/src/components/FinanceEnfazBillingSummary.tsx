"use client";

/**
 * Enfaz work-order billing — the totals card: fee subtotal, keys, VAT, total,
 * the collected amount once issued, and the read-only key-envelope attachments.
 */

import type { PoEnfazBillingDto } from "@platform/api-client";
import { cn, opsBtnGhost, opsPanelCard } from "@platform/ui-kit";
import {
  sarEn,
  type BillingTotals,
} from "../lib/finance-enfaz-po-billing-state";

function SummaryRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between py-1 text-text-2">
      <span>{label}</span>
      <span className={cn("tabular-nums", muted && "text-text-3")} dir="ltr">
        {value}
      </span>
    </div>
  );
}

export function FinanceEnfazBillingSummary({
  billing,
  totals,
  issued,
  onOpenAttachment,
}: {
  billing: PoEnfazBillingDto;
  totals: BillingTotals;
  issued: boolean;
  onOpenAttachment: (id: string, index: number) => void;
}) {
  return (
    <div className={cn(opsPanelCard, "p-4 text-sm")}>
      <div className="mb-2 text-[11px] text-text-3">
        {totals.billable} معاملة مشمولة في الفاتورة
      </div>
      <SummaryRow
        label="إجمالي الأتعاب (تقييم + رفع)"
        value={sarEn(issued ? billing.subtotalSar : totals.taxable)}
      />
      {issued ? (
        <SummaryRow label="أتعاب المفاتيح (ضمن الإجمالي)" value="—" muted />
      ) : (
        <SummaryRow
          label="أتعاب المفاتيح (شاملة الضريبة)"
          value={sarEn(totals.key)}
        />
      )}
      <SummaryRow
        label="ضريبة القيمة المضافة 15%"
        value={sarEn(issued ? billing.vatSar : totals.vat)}
      />
      <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold text-heading">
        <span>الإجمالي المستحق</span>
        <span className="tabular-nums" dir="ltr">
          {sarEn(issued ? billing.totalSar : totals.total)}
        </span>
      </div>
      {issued ? (
        <div className="mt-2 flex justify-between border-t border-border pt-2 text-text-2">
          <span>المحصّل</span>
          <span className="tabular-nums" dir="ltr">
            {sarEn(billing.collectedAmountSar)}
          </span>
        </div>
      ) : null}
      {billing.attachmentIds.length > 0 ? (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 text-[11px] text-text-3">
            مرفقات ظروف المفاتيح (عرض فقط)
          </div>
          <div className="flex flex-wrap gap-2">
            {billing.attachmentIds.map((id, index) => (
              <button
                key={id}
                type="button"
                className={opsBtnGhost}
                onClick={() => onOpenAttachment(id, index)}
              >
                مرفق {index + 1}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
