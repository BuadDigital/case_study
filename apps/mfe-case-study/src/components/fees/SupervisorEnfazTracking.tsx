"use client";

import { fmtSar } from "@platform/app-shared/format/number";
import { useQuery } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { loadEnfazTracking } from "@platform/app-shared/app-data/enfaz-billing-api";
import {
  Badge,
  SkeletonTableRows,
  Table,
  TableFrame,
  TBody,
  Td,
  TdLtr,
  Th,
  THead,
  Tr,
} from "@platform/ui-kit";
import { inspectorFeeWorkStatusTone } from "@platform/api-client";
import type { EnfazTrackingRowDto } from "@platform/api-client";
import {
  enfazInvoiceStatusLabel,
  enfazInvoiceStatusTone,
} from "@platform/app-shared/fees/enfaz-invoice-status";

export function SupervisorEnfazTracking() {
  const { data = [], isPending } = useQuery({
    queryKey: [...appDataKeys.all, "enfaz-billing", "tracking"],
    queryFn: loadEnfazTracking,
  });

  if (isPending) {
    return (
      <TableFrame>
        <Table pending>
          <TBody>
            <SkeletonTableRows rows={3} cols={5} />
          </TBody>
        </Table>
      </TableFrame>
    );
  }

  if (data.length === 0) {
    return (
      <TableFrame>
        <div className="px-4 py-10 text-center text-[13px] text-text-3">
          لا بيانات متابعة حالياً.
        </div>
      </TableFrame>
    );
  }

  return (
    <>
      <TableFrame>
        <Table>
          <THead>
            <Tr hoverable={false}>
              <Th>أمر العمل</Th>
              <Th>المعاملة</Th>
              <Th>حالة العمل</Th>
              <Th>تعبئة الأتعاب</Th>
              <Th>الفاتورة / التحصيل</Th>
            </Tr>
          </THead>
          <TBody>
            {data.map((row: EnfazTrackingRowDto) => (
              <Tr
                key={`${row.poNumber}-${row.propertyId}`}
                hoverable={false}
                className={row.workStatus === "cancelled" ? "opacity-55" : ""}
              >
                <TdLtr valueClassName="font-medium text-primary-light">
                  {row.poNumber}
                </TdLtr>
                <Td>{row.propertyLabel}</Td>
                <Td>
                  <Badge
                    tone={inspectorFeeWorkStatusTone(
                      row.workStatus as "in_progress",
                    )}
                  >
                    {row.workStatusLabel}
                  </Badge>
                </Td>
                <Td>
                  {row.workStatus === "cancelled" ? (
                    <Badge tone="danger">لا تُفوتر</Badge>
                  ) : row.enfazFilled ? (
                    <Badge tone="success">
                      مُعبّأة {fmtSar(row.enfazFeeSar, { digits: 3, trim: true })}
                    </Badge>
                  ) : (
                    <Badge tone="warning">بانتظار التعبئة</Badge>
                  )}
                </Td>
                <Td>
                  {row.workStatus === "cancelled" ? (
                    <span className="text-text-3">—</span>
                  ) : row.invoiceNumber ? (
                    <div className="flex flex-col gap-1">
                      <Badge
                        tone={enfazInvoiceStatusTone(
                          row.invoiceStatus,
                          row.isOverdue,
                        )}
                      >
                        {enfazInvoiceStatusLabel(row.invoiceStatus)}
                        {row.isOverdue ? " · متأخر" : ""}
                      </Badge>
                      <span className="text-[11px] text-text-3">
                        {row.invoiceNumber}
                        {row.collectedAmountSar > 0
                          ? ` · محصّل ${fmtSar(row.collectedAmountSar, { digits: 3, trim: true })}`
                          : ""}
                      </span>
                    </div>
                  ) : (
                    <Badge tone="default">بلا فاتورة</Badge>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableFrame>
      <p className="mt-3 text-xs text-text-3">
        متابعة فقط — التعبئة والتحصيل من سطح المالية. المتأخر = أكثر من ٣٠ يوماً
        من الإصدار بلا تحصيل كامل.
      </p>
    </>
  );
}
