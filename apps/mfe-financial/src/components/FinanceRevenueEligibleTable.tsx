"use client";

/** Revenue stage «مؤهلة للفوترة» — handed-over rows, newest first: the accountant's mark, then the match / refresh actions. */

import { useMemo } from "react";
import type { EnfazTrackingRowDto } from "@platform/api-client";
import {
  MobileRecordCard,
  MobileRecordList,
  TBody,
  Table,
  TableFrame,
  Td,
  Tr,
  cn,
  opsBtnGhost,
  opsBtnPrimary,
} from "@platform/ui-kit";
import { sortByCompletedDesc } from "../lib/finance-revenue-state";
import {
  DeedCell,
  PoCell,
  RevenueLeadCells,
  RevenueTableHead,
  TotalFeesValue,
  revenueCityDateFields,
} from "./FinanceRevenueTableParts";

/**
 * A deed whose financial data has not been marked yet waits for the accountant's «تعليم جاهز للفوترة»;
 * a marked one goes on to «مطابقة الأتعاب» (until the fees are matched) + «تحديث حالة إنفاذ».
 * Table cell and phone card.
 *
 * How it works: an unmarked deed shows the mark button to the financial officer (`canMarkReady`) and a
 * «waiting for its financial data on Enfaz» note to anyone else; a marked deed shows the match button
 * (only while `enfazFilled` is false) and the refresh button, both opening the work order's billing sheet.
 *
 * Edge cases: while one mark is in flight (`markingId` set) every mark button is disabled — not only
 * the clicked one — so two deeds cannot be marked at once; the clicked button reads «جارٍ التعليم…».
 */
function EligibleActions({
  row,
  onOpenPo,
  canMarkReady,
  markingId,
  onMarkReady,
}: {
  row: EnfazTrackingRowDto;
  onOpenPo: (po: string) => void;
  canMarkReady: boolean;
  markingId: string | null;
  onMarkReady: (row: EnfazTrackingRowDto) => void;
}) {
  if (!row.billingReadyAtUtc) {
    return canMarkReady ? (
      <button
        type="button"
        className={cn(opsBtnPrimary, "px-3 py-2 text-[11.5px]", markingId === row.propertyId && "opacity-60")}
        title="ظهرت البيانات المالية لهذا الصك على منصة إنفاذ"
        disabled={markingId !== null}
        onClick={() => onMarkReady(row)}
      >
        {markingId === row.propertyId ? "جارٍ التعليم…" : "تعليم جاهز للفوترة"}
      </button>
    ) : (
      <span className="text-[11.5px] text-text-3">بانتظار ظهور بياناته المالية على إنفاذ</span>
    );
  }
  return (
    <>
      {!row.enfazFilled ? (
        <button
          type="button"
          className={cn(opsBtnPrimary, "px-3 py-2 text-[11.5px]")}
          data-po-intent={row.poNumber}
          onClick={() => onOpenPo(row.poNumber)}
        >
          مطابقة الأتعاب
        </button>
      ) : null}
      <button
        type="button"
        className={cn(opsBtnGhost, "h-auto px-[11px] py-2 text-[11.5px]")}
        title="تحديث حالة المعاملة كما هي في منصة إنفاذ"
        data-po-intent={row.poNumber}
        onClick={() => onOpenPo(row.poNumber)}
      >
        تحديث حالة إنفاذ
      </button>
    </>
  );
}

export function EligibleTable({
  rows,
  onOpenPo,
  canMarkReady = false,
  markingId = null,
  onMarkReady = () => {},
}: {
  rows: EnfazTrackingRowDto[];
  onOpenPo: (po: string) => void;
  canMarkReady?: boolean;
  markingId?: string | null;
  onMarkReady?: (row: EnfazTrackingRowDto) => void;
}) {
  const actionProps = { onOpenPo, canMarkReady, markingId, onMarkReady };
  const sorted = useMemo(() => sortByCompletedDesc(rows), [rows]);

  return (
    <>
    {/* Phones: one card per row, actions as full-width buttons. */}
    <MobileRecordList className="lg:hidden">
      {sorted.map((row) => (
        <MobileRecordCard
          key={`${row.poNumber}-${row.propertyId}`}
          tone={!row.billingReadyAtUtc || !row.enfazFilled ? "gold" : undefined}
          title={<PoCell po={row.poNumber} />}
          subtitle={<DeedCell deed={row.deedNumber} />}
          fields={[
            ...revenueCityDateFields(row),
            { label: "إجمالي الأتعاب", value: <TotalFeesValue row={row} />, wide: true },
          ]}
          actions={<EligibleActions row={row} {...actionProps} />}
        />
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
            "إجمالي الأتعاب",
            "الإجراء",
          ]}
        />
        <TBody>
          {sorted.map((row) => (
            <Tr key={`${row.poNumber}-${row.propertyId}`}>
              <RevenueLeadCells row={row} />
              <Td className="text-center">
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <EligibleActions row={row} {...actionProps} />
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableFrame>
    </>
  );
}
