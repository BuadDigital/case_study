"use client";

/** Revenue stage «مساعد الفوترة» — selectable rows grouped under their work order with a totals row. */

import { Fragment, useMemo } from "react";
import { fmt } from "@platform/app-shared/format/number";
import type { EnfazTrackingRowDto } from "@platform/api-client";
import {
  TBody,
  Table,
  TableFrame,
  Td,
  TdLtr,
  Tr,
  cn,
  opsCheckInput,
} from "@platform/ui-kit";
import {
  groupRowsByPo,
  revenueAmountsFromRow,
} from "../lib/finance-revenue-stages";
import { sumRevenueAmounts, textOrDash } from "../lib/finance-revenue-state";
import { finMuted } from "../lib/finance-tw";
import {
  Chevron,
  DeedCell,
  FeeFlags,
  GroupHeaderRow,
  RevenueTableHead,
  TotalsBlankCell,
  TotalsLabelCell,
  TotalsValueCell,
} from "./FinanceRevenueTableParts";

export function BillingAssistantTable({
  rows,
  selected,
  onToggle,
  collapsed,
  onToggleGroup,
}: {
  rows: EnfazTrackingRowDto[];
  selected: Record<string, boolean>;
  onToggle: (propertyId: string) => void;
  collapsed: Record<string, boolean>;
  onToggleGroup: (po: string) => void;
}) {
  const colSpan = 9;
  const groups = useMemo(() => groupRowsByPo(rows), [rows]);

  return (
    <TableFrame>
      <Table className="min-w-[1080px]">
        <RevenueTableHead
          firstStart={false}
          heads={[
            "",
            "رقم الصك",
            "مساحة الأرض (م٢)",
            "مسطح البناء (م٢)",
            "أتعاب المفاتيح",
            "الأتعاب",
            "الضريبة",
            "شاملة الضريبة",
            "الإجمالي المستحق",
          ]}
        />
        <TBody>
          {groups.map(({ poNumber, rows: group }) => {
            const open = collapsed[poNumber] === true;
            const sums = sumRevenueAmounts(group);
            return (
              <Fragment key={poNumber}>
                <GroupHeaderRow
                  colSpan={colSpan}
                  onToggle={() => onToggleGroup(poNumber)}
                >
                  <div className="flex w-full flex-wrap items-center justify-between gap-2.5">
                    <span className="inline-flex flex-wrap items-center gap-[9px]">
                      <Chevron open={open} />
                      <span className="text-[12.5px] font-extrabold text-heading">
                        أمر العمل{" "}
                        <span dir="ltr">{poNumber}</span>
                      </span>
                      <span className="text-[11px] text-text-3">
                        {group.length} معاملة · الإجمالي المستحق{" "}
                        <b className="text-heading" dir="ltr">
                          {fmt(sums.gross, 2)}
                        </b>{" "}
                        ر.س
                      </span>
                    </span>
                  </div>
                </GroupHeaderRow>
                {open
                  ? group.map((row) => {
                      const a = revenueAmountsFromRow(row);
                      const on = !!selected[row.propertyId];
                      return (
                        <Tr
                          key={row.propertyId}
                          role="button"
                          tabIndex={0}
                          className={cn(
                            "cursor-pointer",
                            on &&
                              "bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]",
                          )}
                          onClick={() => onToggle(row.propertyId)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onToggle(row.propertyId);
                            }
                          }}
                        >
                          <Td className="text-center">
                            <input
                              type="checkbox"
                              className={opsCheckInput}
                              checked={on}
                              onChange={() => onToggle(row.propertyId)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`تحديد ${row.deedNumber}`}
                            />
                          </Td>
                          <Td className="text-center">
                            <DeedCell deed={row.deedNumber} />
                          </Td>
                          <TdLtr className="text-center" valueClassName={finMuted}>
                            {textOrDash(row.landArea)}
                          </TdLtr>
                          <TdLtr className="text-center" valueClassName={finMuted}>
                            —
                          </TdLtr>
                          <TdLtr className="text-center" valueClassName={finMuted}>
                            {fmt(a.key, 2)}
                          </TdLtr>
                          <TdLtr className="text-center" valueClassName="text-xs text-text">
                            {fmt(a.taxable, 2)}
                          </TdLtr>
                          <TdLtr className="text-center" valueClassName={finMuted}>
                            {fmt(a.vat, 2)}
                          </TdLtr>
                          <TdLtr className="text-center" valueClassName="text-xs text-text">
                            {fmt(a.withVat, 2)}
                          </TdLtr>
                          <Td className="text-center">
                            <span className="inline-flex items-center gap-2.5">
                              <FeeFlags row={row} />
                              <span
                                className="text-[12.5px] font-bold text-heading"
                                dir="ltr"
                              >
                                {fmt(a.total, 2)}
                              </span>
                            </span>
                          </Td>
                        </Tr>
                      );
                    })
                  : null}
                {open ? (
                  <Tr hoverable={false}>
                    <TotalsBlankCell />
                    <TotalsLabelCell>إجمالي أمر العمل</TotalsLabelCell>
                    <TotalsBlankCell />
                    <TotalsBlankCell />
                    <TotalsValueCell valueClassName="text-[11.5px] font-bold text-text-2">
                      {fmt(sums.key, 2)}
                    </TotalsValueCell>
                    <TotalsValueCell valueClassName="text-[11.5px] font-bold text-text">
                      {fmt(sums.base, 2)}
                    </TotalsValueCell>
                    <TotalsValueCell valueClassName="text-[11.5px] font-bold text-text-2">
                      {fmt(sums.vat, 2)}
                    </TotalsValueCell>
                    <TotalsValueCell valueClassName="text-[11.5px] font-bold text-text">
                      {fmt(sums.base + sums.vat, 2)}
                    </TotalsValueCell>
                    <TotalsValueCell valueClassName="text-[12.5px] font-extrabold text-heading">
                      {fmt(sums.gross, 2)}
                    </TotalsValueCell>
                  </Tr>
                ) : null}
              </Fragment>
            );
          })}
        </TBody>
      </Table>
    </TableFrame>
  );
}
