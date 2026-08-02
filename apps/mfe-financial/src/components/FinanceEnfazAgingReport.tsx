"use client";

import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadEnfazAgingReport } from "@platform/app-shared/prototype/enfaz-billing-api";
import {
  Badge,
  EmptyState,
  Note,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@platform/design-system";

function formatSar(n: number) {
  return `${n.toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س`;
}

function bucketTone(
  key: string,
): "success" | "info" | "warning" | "danger" | "default" {
  switch (key) {
    case "0_30":
      return "success";
    case "31_60":
      return "info";
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

export function FinanceEnfazAgingReport() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: [...prototypeKeys.all, "enfaz-billing", "aging"],
    queryFn: loadEnfazAgingReport,
  });

  if (isPending) {
    return (
      <Table pending>
        <TBody>
          <SkeletonTableRows rows={4} cols={6} />
        </TBody>
      </Table>
    );
  }

  if (isError) {
    return (
      <Note tone="warn">
        {error instanceof Error
          ? error.message
          : "تعذّر تحميل تقرير التقادم"}
        <button
          type="button"
          className="ms-2 underline"
          onClick={() => void refetch()}
        >
          إعادة المحاولة
        </button>
      </Note>
    );
  }

  if (!data || data.openInvoiceCount === 0) {
    return (
      <EmptyState
        line="لا ذمم مفتوحة لإنفاذ."
        hint="يظهر هنا كل فاتورة صادرة لم تُحصَّل بالكامل، مصنّفة حسب عمرها من تاريخ الإصدار."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Note tone="info" className="m-0">
        إجمالي المستحق:{" "}
        <strong>{formatSar(data.totalOutstandingSar)}</strong> عبر{" "}
        <strong>{data.openInvoiceCount}</strong> فاتورة مفتوحة.
      </Note>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {data.buckets.map((bucket) => (
          <div
            key={bucket.key}
            className="rounded-[var(--radius-lg)] border border-border bg-surface p-3"
          >
            <div className="mb-1 flex items-center gap-1.5">
              <Badge tone={bucketTone(bucket.key)}>{bucket.label}</Badge>
            </div>
            <div className="text-lg font-semibold tabular-nums text-text">
              {formatSar(bucket.outstandingSar)}
            </div>
            <div className="text-[11px] text-text-3">
              {bucket.invoiceCount} فاتورة
            </div>
          </div>
        ))}
      </div>

      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th>أمر العمل</Th>
            <Th>الفاتورة</Th>
            <Th>العمر</Th>
            <Th>الفئة</Th>
            <Th>المستحق</Th>
            <Th>الحالة</Th>
          </Tr>
        </THead>
        <TBody>
          {data.invoices.map((row) => (
            <Tr key={`${row.poNumber}-${row.invoiceNumber}`} hoverable={false}>
              <Td className="font-medium text-primary-light">{row.poNumber}</Td>
              <Td className="text-text-2">{row.invoiceNumber}</Td>
              <Td className="tabular-nums">{row.ageDays} يوماً</Td>
              <Td>
                <Badge tone={bucketTone(row.bucketKey)}>{row.bucketLabel}</Badge>
              </Td>
              <Td className="tabular-nums font-medium">
                {formatSar(row.outstandingSar)}
              </Td>
              <Td>
                <Badge
                  tone={
                    row.status === "partially_collected" ? "warning" : "info"
                  }
                >
                  {statusLabel(row.status)}
                </Badge>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
