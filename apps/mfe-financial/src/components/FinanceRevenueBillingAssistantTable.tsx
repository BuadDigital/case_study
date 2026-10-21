"use client";

/** Revenue stage «مساعد الفوترة» — selectable rows grouped under their work order with a totals row. */

import { Fragment, useMemo } from "react";
import { fmt } from "@platform/app-shared/format/number";
import type { EnfazTrackingRowDto } from "@platform/api-client";
import {
  MobileRecordCard,
  MobileRecordList,
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
  MobileGroupHeader,
  MobileTotalsCard,
  RevenueTableHead,
  TotalsBlankCell,
  TotalsLabelCell,
  TotalsValueCell,
} from "./FinanceRevenueTableParts";

/** Row checkbox (table cell and the leading element of a phone card's title). */
function RowCheck({
  row,
  on,
  onToggle,
}: {
  row: EnfazTrackingRowDto;
  on: boolean;
  onToggle: (propertyId: string) => void;
}) {
  return (
    <input
      type="checkbox"
      className={opsCheckInput}
      checked={on}
      onChange={() => onToggle(row.propertyId)}
      onClick={(e) => e.stopPropagation()}
      aria-label={`تحديد ${row.deedNumber}`}
    />
  );
}

/** «أمر العمل …» + «N معاملة · الإجمالي المستحق …» (desktop header row and phone header). */
function PoGroupTitle({
  poNumber,
  count,
  gross,
}: {
  poNumber: string;
  count: number;
  gross: number;
}) {
  return (
    <>
      <span className="text-[12.5px] font-extrabold text-heading">
        أمر العمل{" "}
        <span dir="ltr">{poNumber}</span>
      </span>
      <span className="text-[11px] text-text-3">
        {count} معاملة · الإجمالي المستحق{" "}
        <b className="text-heading" dir="ltr">
          {fmt(gross, 2)}
        </b>{" "}
        ر.س
      </span>
    </>
  );
}

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
    <>
    {/* Phones: a collapsible header per work order over selectable deed cards
        (tap or checkbox) and a work-order totals card — every column kept. */}
    <div className="flex min-w-0 flex-col gap-2.5 lg:hidden">
      {groups.map(({ poNumber, rows: group }) => {
        const open = collapsed[poNumber] === true;
        const sums = sumRevenueAmounts(group);
        return (
          <div key={poNumber} className="flex min-w-0 flex-col gap-2">
            <MobileGroupHeader open={open} onToggle={() => onToggleGroup(poNumber)}>
              <PoGroupTitle poNumber={poNumber} count={group.length} gross={sums.gross} />
            </MobileGroupHeader>
            {open ? (
              <MobileRecordList>
                {group.map((row) => {
                  const a = revenueAmountsFromRow(row);
                  const on = !!selected[row.propertyId];
                  return (
                    <MobileRecordCard
                      key={row.propertyId}
                      tone={on ? "ink" : undefined}
                      className={cn(
                        on && "bg-[color-mix(in_srgb,var(--ink)_5%,var(--surface))]",
                      )}
                      onOpen={() => onToggle(row.propertyId)}
                      title={
                        <span className="inline-flex items-center gap-2.5">
                          <RowCheck row={row} on={on} onToggle={onToggle} />
                          <DeedCell deed={row.deedNumber} />
                        </span>
                      }
                      status={<FeeFlags row={row} />}
                      fields={[
                        { label: "مساحة الأرض (م²)", ltr: true, value: textOrDash(row.landArea) },
                        { label: "مسطح البناء (م²)", ltr: true, value: "—" },
                        { label: "أتعاب المفاتيح", ltr: true, value: fmt(a.key, 2) },
                        { label: "الأتعاب", ltr: true, value: fmt(a.taxable, 2) },
                        { label: "الضريبة", ltr: true, value: fmt(a.vat, 2) },
                        { label: "شاملة الضريبة", ltr: true, value: fmt(a.withVat, 2) },
                        { label: "الإجمالي المستحق", ltr: true, value: fmt(a.total, 2), wide: true },
                      ]}
                    />
                  );
                })}
                <MobileTotalsCard
                  title="إجمالي أمر العمل"
                  fields={[
                    { label: "أتعاب المفاتيح", ltr: true, value: fmt(sums.key, 2) },
                    { label: "الأتعاب", ltr: true, value: fmt(sums.base, 2) },
                    { label: "الضريبة", ltr: true, value: fmt(sums.vat, 2) },
                    { label: "شاملة الضريبة", ltr: true, value: fmt(sums.base + sums.vat, 2) },
                    { label: "الإجمالي المستحق", ltr: true, value: fmt(sums.gross, 2), wide: true },
                  ]}
                />
              </MobileRecordList>
            ) : null}
          </div>
        );
      })}
    </div>
    <TableFrame className="max-lg:hidden">
      <Table className="min-w-[1080px]">
        <RevenueTableHead
          firstStart={false}
          heads={[
            "",
            "رقم الصك",
            "مساحة الأرض (م²)",
            "مسطح البناء (م²)",
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
                      <PoGroupTitle
                        poNumber={poNumber}
                        count={group.length}
                        gross={sums.gross}
                      />
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
                            <RowCheck row={row} on={on} onToggle={onToggle} />
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
    </>
  );
}
