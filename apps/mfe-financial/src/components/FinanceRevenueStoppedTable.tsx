"use client";

/** Revenue stages «متوقفة» (recall action) and «مستبعدة» (display only) — same columns, different reason head. */

import type { EnfazTrackingRowDto } from "@platform/api-client";
import {
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
} from "./FinanceRevenueTableParts";

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
    <TableFrame>
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
                {row.isOverdue ? (
                  <StatusPill
                    label="متأخر"
                    style={finStatusStyle("danger")}
                    className="ms-1.5 text-[10px]"
                  />
                ) : null}
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
                  <button
                    type="button"
                    className={cn(opsBtnGhost, "h-auto px-3 py-[7px] text-[11.5px]")}
                    onClick={() => onRecall!(row.poNumber)}
                  >
                    استدعاء — تحديث الحالة
                  </button>
                ) : (
                  <span className="text-[12px] text-text-3">عرض فقط</span>
                )}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableFrame>
  );
}
