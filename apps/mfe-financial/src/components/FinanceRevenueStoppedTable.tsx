"use client";

/** Revenue stages «متوقفة» (recall action) and «مستبعدة» (display only) — same columns, different reason head. */

import type { EnfazTrackingRowDto } from "@platform/api-client";
import {
  MobileRecordCard,
  MobileRecordList,
  StatusPill,
  TBody,
  Table,
  TableFrame,
  Td,
  Tr,
  cn,
  finStatusStyle,
  opsBtnGhost,
} from "@platform/ui-kit";
import { stoppedReasonLabel } from "../lib/finance-revenue-stages";
import {
  CityCell,
  CompletedAtCell,
  DeedCell,
  PoCell,
  RevenueTableHead,
  revenueCityDateFields,
} from "./FinanceRevenueTableParts";

function OverduePill({ className }: { className?: string }) {
  return (
    <StatusPill
      label="متأخر"
      style={finStatusStyle("danger")}
      className={cn("text-[10px]", className)}
    />
  );
}

/** «استدعاء — تحديث الحالة» button (table cell and phone card). */
function RecallButton({
  po,
  onRecall,
}: {
  po: string;
  onRecall: (po: string) => void;
}) {
  return (
    <button
      type="button"
      className={cn(opsBtnGhost, "h-auto px-3 py-[7px] text-[11.5px]")}
      data-po-intent={po}
      onClick={() => onRecall(po)}
    >
      استدعاء — تحديث الحالة
    </button>
  );
}

export function StoppedTable({
  rows,
  onRecall,
  mode = "stopped",
}: {
  rows: EnfazTrackingRowDto[];
  onRecall?: (po: string) => void;
  /** stopped = recall action · excluded = display only */
  mode?: "stopped" | "excluded";
}) {
  const reasonHead = mode === "excluded" ? "سبب الاستبعاد" : "سبب التوقف";
  const showAction = mode === "stopped" && onRecall != null;
  return (
    <>
    {/* Phones: one card per row; the reason gets a full-width field. */}
    <MobileRecordList className="lg:hidden">
      {rows.map((row) => (
        <MobileRecordCard
          key={`${row.poNumber}-${row.propertyId}`}
          tone={row.isOverdue ? "red" : undefined}
          title={<PoCell po={row.poNumber} />}
          subtitle={<DeedCell deed={row.deedNumber} />}
          status={row.isOverdue ? <OverduePill /> : undefined}
          fields={[
            ...revenueCityDateFields(row),
            { label: reasonHead, value: stoppedReasonLabel(row), wide: true },
          ]}
          actions={
            showAction ? <RecallButton po={row.poNumber} onRecall={onRecall} /> : undefined
          }
        >
          {showAction ? null : (
            <span className="text-[12px] text-text-3">عرض فقط</span>
          )}
        </MobileRecordCard>
      ))}
    </MobileRecordList>
    <TableFrame className="max-lg:hidden">
      <Table className="min-w-[820px]">
        <RevenueTableHead
          heads={[
            "رقم الطلب",
            "رقم الصك",
            "المدينة",
            "تاريخ الاكتمال",
            reasonHead,
            "الإجراء",
          ]}
        />
        <TBody>
          {rows.map((row) => (
            <Tr key={`${row.poNumber}-${row.propertyId}`}>
              <Td className="text-center">
                <PoCell po={row.poNumber} />
                {row.isOverdue ? <OverduePill className="ms-1.5" /> : null}
              </Td>
              <Td className="text-center">
                <DeedCell deed={row.deedNumber} />
              </Td>
              <CityCell row={row} />
              <CompletedAtCell iso={row.completedAtUtc} />
              <Td className="text-center">
                <span className="text-start text-xs text-text-2">
                  {stoppedReasonLabel(row)}
                </span>
              </Td>
              <Td className="text-center">
                {showAction ? (
                  <RecallButton po={row.poNumber} onRecall={onRecall} />
                ) : (
                  <span className="text-[12px] text-text-3">عرض فقط</span>
                )}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableFrame>
    </>
  );
}
