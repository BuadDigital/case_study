"use client";

import { fmtSar } from "@platform/app-shared/format/number";
import { useQuery } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { loadEnfazTracking } from "@platform/app-shared/app-data/enfaz-billing-api";
import {
  Badge,
  MobileRecordCard,
  MobileRecordList,
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

/** Fee-fill state of one tracked transaction (table cell and phone card). */
function EnfazFillStatus({ row }: { row: EnfazTrackingRowDto }) {
  return (
    <>
    {row.workStatus === "cancelled" ? (
      <Badge tone="danger">لا تُفوتر</Badge>
    ) : row.enfazFilled ? (
      <Badge tone="success">
        مُعبّأة {fmtSar(row.enfazFeeSar, { digits: 3, trim: true })}
      </Badge>
    ) : (
      <Badge tone="warning">بانتظار التعبئة</Badge>
    )}
    </>
  );
}

/** Invoice / collection state of one tracked transaction (table cell and phone card). */
function EnfazInvoiceStatus({ row }: { row: EnfazTrackingRowDto }) {
  return (
    <>
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
    </>
  );
}

export function SupervisorEnfazTracking() {
  const { data = [], isPending } = useQuery({
    queryKey: [...appDataKeys.all, "enfaz-billing", "tracking"],
    queryFn: loadEnfazTracking,
  });

  if (isPending) {
    return (
      <>
      <MobileRecordList className="lg:hidden" isEmpty empty="جاري التحميل…">
        {null}
      </MobileRecordList>
      <TableFrame className="max-lg:hidden">
        <Table pending>
          <TBody>
            <SkeletonTableRows rows={3} cols={5} />
          </TBody>
        </Table>
      </TableFrame>
      </>
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
      {/* Phones: one card per transaction instead of the five-column table. */}
      <MobileRecordList className="lg:hidden">
        {data.map((row: EnfazTrackingRowDto) => (
          <MobileRecordCard
            key={`${row.poNumber}-${row.propertyId}`}
            className={row.workStatus === "cancelled" ? "opacity-55" : undefined}
            title={row.propertyLabel}
            subtitle={<bdi dir="ltr">{row.poNumber}</bdi>}
            status={
              <Badge
                tone={inspectorFeeWorkStatusTone(row.workStatus as "in_progress")}
              >
                {row.workStatusLabel}
              </Badge>
            }
            fields={[
              { label: "تعبئة الأتعاب", value: <EnfazFillStatus row={row} /> },
              { label: "الفاتورة / التحصيل", value: <EnfazInvoiceStatus row={row} /> },
            ]}
          />
        ))}
      </MobileRecordList>
      <TableFrame className="max-lg:hidden">
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
                  <EnfazFillStatus row={row} />
                </Td>
                <Td>
                  <EnfazInvoiceStatus row={row} />
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
