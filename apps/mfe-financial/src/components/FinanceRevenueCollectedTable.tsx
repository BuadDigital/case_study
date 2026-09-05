"use client";

/** Revenue stage «محصّلة» — display-only rows with their invoice reference. */

import type { EnfazTrackingRowDto } from "@platform/api-client";
import {
  StatusPill,
  TBody,
  Table,
  TableFrame,
  Td,
  TdLtr,
  Tr,
  finStatusStyle,
} from "@platform/ui-kit";
import { formatDateEn } from "../lib/finance-revenue-stages";
import { textOrDash } from "../lib/finance-revenue-state";
import { finMuted } from "../lib/finance-tw";
import {
  CityCell,
  CompletedAtCell,
  DeedCell,
  PoCell,
  RevenueTableHead,
  TotalFeesCell,
} from "./FinanceRevenueTableParts";

export function CollectedTable({ rows }: { rows: EnfazTrackingRowDto[] }) {
  return (
    <TableFrame>
      <Table className="min-w-[960px]">
        <RevenueTableHead
          heads={[
            "رقم الطلب",
            "رقم الصك",
            "المدينة",
            "تاريخ الاكتمال",
            "إجمالي الأتعاب",
            "الفاتورة",
            "تاريخ التحويل",
            "الحالة",
          ]}
        />
        <TBody>
          {rows.map((row) => (
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
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs font-bold text-text" dir="ltr">
                    {textOrDash(row.invoiceNumber)}
                  </span>
                  <span className="text-[10.5px] text-text-3" dir="ltr">
                    {formatDateEn(row.invoiceIssuedAtUtc)}
                  </span>
                </div>
              </Td>
              <TdLtr className="text-center" valueClassName={finMuted}>
                —
              </TdLtr>
              <Td className="text-center">
                <StatusPill label="محصّلة" style={finStatusStyle("success")} />
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableFrame>
  );
}
