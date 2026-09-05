"use client";

/** Revenue stage «جاهزة للمطابقة» — completed rows, newest first, with the match / refresh actions. */

import { useMemo } from "react";
import type { EnfazTrackingRowDto } from "@platform/api-client";
import {
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
  CityCell,
  CompletedAtCell,
  DeedCell,
  PoCell,
  RevenueTableHead,
  TotalFeesCell,
} from "./FinanceRevenueTableParts";

export function EligibleTable({
  rows,
  onOpenPo,
}: {
  rows: EnfazTrackingRowDto[];
  onOpenPo: (po: string) => void;
}) {
  const sorted = useMemo(() => sortByCompletedDesc(rows), [rows]);

  return (
    <TableFrame>
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
              <Td className="text-center">
                <PoCell po={row.poNumber} />
              </Td>
              <Td className="text-center">
                <DeedCell deed={row.deedNumber} />
              </Td>
              <CityCell row={row} />
              <CompletedAtCell iso={row.completedAtUtc} />
              <TotalFeesCell row={row} />
              <Td className="text-center">
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {!row.enfazFilled ? (
                    <button
                      type="button"
                      className={cn(opsBtnPrimary, "px-3 py-2 text-[11.5px]")}
                      onClick={() => onOpenPo(row.poNumber)}
                    >
                      مطابقة الأتعاب
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={cn(opsBtnGhost, "h-auto px-[11px] py-2 text-[11.5px]")}
                    title="تحديث حالة المعاملة كما هي في منصة إنفاذ"
                    onClick={() => onOpenPo(row.poNumber)}
                  >
                    تحديث حالة إنفاذ
                  </button>
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableFrame>
  );
}
