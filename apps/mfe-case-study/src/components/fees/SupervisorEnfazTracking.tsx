"use client";

import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadEnfazTracking } from "@platform/app-shared/prototype/enfaz-billing-api";
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

function invoiceStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "collected":
      return "محصّلة";
    case "partially_collected":
      return "تحصيل جزئي";
    case "issued":
      return "صادرة";
    default:
      return "بلا فاتورة";
  }
}

function invoiceStatusTone(
  status: string | null | undefined,
  overdue: boolean,
): "success" | "warning" | "danger" | "info" | "default" {
  if (overdue) return "danger";
  if (status === "collected") return "success";
  if (status === "partially_collected") return "warning";
  if (status === "issued") return "info";
  return "default";
}

export function SupervisorEnfazTracking() {
  const { data = [], isPending } = useQuery({
    queryKey: [...prototypeKeys.all, "enfaz-billing", "tracking"],
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
                      مُعبّأة {row.enfazFeeSar.toLocaleString("ar-SA")} ر.س
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
                        tone={invoiceStatusTone(
                          row.invoiceStatus,
                          row.isOverdue,
                        )}
                      >
                        {invoiceStatusLabel(row.invoiceStatus)}
                        {row.isOverdue ? " · متأخر" : ""}
                      </Badge>
                      <span className="text-[11px] text-text-3">
                        {row.invoiceNumber}
                        {row.collectedAmountSar > 0
                          ? ` · محصّل ${row.collectedAmountSar.toLocaleString("ar-SA")} ر.س`
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
