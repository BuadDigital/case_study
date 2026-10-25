"use client";

/** Revenue stage «محصّلة» — display-only rows with their invoice reference. */

import type { EnfazTrackingRowDto } from "@platform/api-client";
import {
  MobileRecordCard,
  MobileRecordList,
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
  DeedCell,
  PoCell,
  RevenueLeadCells,
  RevenueTableHead,
  TotalFeesValue,
  revenueCityDateFields,
} from "./FinanceRevenueTableParts";

const collectedPill = (
  <StatusPill label="محصّلة" style={finStatusStyle("success")} />
);

export function CollectedTable({ rows }: { rows: EnfazTrackingRowDto[] }) {
  return (
    <>
    {/* Phones: one card per row — the 8-column table ran off-screen. */}
    <MobileRecordList className="lg:hidden">
      {rows.map((row) => (
        <MobileRecordCard
          key={`${row.poNumber}-${row.propertyId}`}
          title={<PoCell po={row.poNumber} />}
          subtitle={<DeedCell deed={row.deedNumber} />}
          status={collectedPill}
          fields={[
            ...revenueCityDateFields(row),
            { label: "إجمالي الأتعاب", value: <TotalFeesValue row={row} /> },
            {
              label: "الفاتورة",
              ltr: true,
              value: `${textOrDash(row.invoiceNumber)} · ${formatDateEn(row.invoiceIssuedAtUtc)}`,
            },
            { label: "تاريخ التحويل", ltr: true, value: "—" },
          ]}
        />
      ))}
    </MobileRecordList>
    <TableFrame className="max-lg:hidden">
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
              <RevenueLeadCells row={row} />
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
              <Td className="text-center">{collectedPill}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableFrame>
    </>
  );
}
