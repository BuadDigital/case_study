"use client";

import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadEnfazAgingReport } from "@platform/app-shared/prototype/enfaz-billing-api";
import { cn } from "@platform/design-system";
import {
  finEmpty,
  finEmptyS,
  finEmptyT,
  finHint,
  finMuted,
  finNote,
  finNum,
  finPo,
  finRow,
  finScroll,
  finStatusFor,
  finTd,
  finTh,
  finThead,
} from "../lib/finance-tw";

function formatSar(n: number) {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ر.س`;
}

function bucketStatus(key: string): string {
  switch (key) {
    case "0_30":
      return "success";
    case "31_60":
      return "default";
    case "61_90":
      return "warning";
    case "90_plus":
      return "danger";
    default:
      return "default";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "partially_collected":
      return "تحصيل جزئي";
    case "issued":
      return "صادرة";
    default:
      return status || "—";
  }
}

const agingCols =
  "min-w-full grid-cols-[minmax(100px,1fr)_minmax(100px,1fr)_70px_90px_100px_90px]";

export function FinanceEnfazAgingReport() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: [...prototypeKeys.all, "enfaz-billing", "aging"],
    queryFn: loadEnfazAgingReport,
  });

  if (isPending) {
    return (
      <div className={finEmpty}>
        <div className={finEmptyT}>جاري التحميل…</div>
      </div>
    );
  }

  if (isError) {
    return (
      <p className={cn(finNote, "mb-0")}>
        {error instanceof Error
          ? error.message
          : "تعذّر تحميل تقرير التقادم"}{" "}
        <button
          type="button"
          className="ms-1 font-bold text-gold-d underline"
          onClick={() => void refetch()}
        >
          إعادة المحاولة
        </button>
      </p>
    );
  }

  if (!data || data.openInvoiceCount === 0) {
    return (
      <div className={finEmpty}>
        <div className={finEmptyT}>لا ذمم مفتوحة لإنفاذ.</div>
        <div className={finEmptyS}>
          يظهر هنا كل فاتورة صادرة لم تُحصَّل بالكامل، مصنّفة حسب عمرها من تاريخ
          الإصدار.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className={cn(finNote, "mb-0")}>
        إجمالي المستحق:{" "}
        <strong className="text-heading">{formatSar(data.totalOutstandingSar)}</strong>{" "}
        عبر <strong className="text-heading">{data.openInvoiceCount}</strong>{" "}
        فاتورة مفتوحة.
      </p>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {data.buckets.map((bucket) => (
          <div
            key={bucket.key}
            className="rounded-xl border border-border bg-surface-2 px-3.5 py-3"
          >
            <div className="mb-1.5">
              <span className={finStatusFor(bucketStatus(bucket.key))}>
                {bucket.label}
              </span>
            </div>
            <div className={cn(finNum, "text-[18px]")}>
              {formatSar(bucket.outstandingSar)}
            </div>
            <div className={cn(finMuted, "mt-1 text-[11px]")}>
              {bucket.invoiceCount} فاتورة
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className={finScroll}>
          <div>
            <div className={cn(finThead, agingCols)}>
              <div className={finTh}>أمر العمل</div>
              <div className={finTh}>الفاتورة</div>
              <div className={finTh}>العمر</div>
              <div className={finTh}>الفئة</div>
              <div className={finTh}>المستحق</div>
              <div className={finTh}>الحالة</div>
            </div>
            {data.invoices.map((row) => (
              <div
                key={`${row.poNumber}-${row.invoiceNumber}`}
                className={cn(finRow, agingCols)}
              >
                <div className={finTd}>
                  <span className={finPo}>{row.poNumber}</span>
                </div>
                <div className={finTd}>
                  <span className={finMuted} dir="ltr">
                    {row.invoiceNumber}
                  </span>
                </div>
                <div className={finTd}>
                  <span className={finNum}>{row.ageDays}</span>
                </div>
                <div className={finTd}>
                  <span className={finStatusFor(bucketStatus(row.bucketKey))}>
                    {row.bucketLabel}
                  </span>
                </div>
                <div className={finTd}>
                  <span className={finNum}>
                    {formatSar(row.outstandingSar)}
                  </span>
                </div>
                <div className={finTd}>
                  <span
                    className={finStatusFor(
                      row.status === "partially_collected"
                        ? "warning"
                        : "default",
                    )}
                  >
                    {statusLabel(row.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className={finHint}>العمر بالأيام من تاريخ إصدار الفاتورة.</p>
    </div>
  );
}
