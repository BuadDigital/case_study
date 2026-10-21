"use client";

/** Revenue stage «بانتظار التحصيل» — rows grouped under their invoice with collect / follow-up actions. */

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
  opsBtnGhost,
  opsBtnPrimary,
} from "@platform/ui-kit";
import {
  formatDateEn,
  groupRowsByInvoice,
  revenueAmountsFromRow,
  rowAgeDays,
} from "../lib/finance-revenue-stages";
import {
  followButtonLabel,
  followupSuffix,
  sumRevenueAmounts,
} from "../lib/finance-revenue-state";
import { finMuted } from "../lib/finance-tw";
import {
  Chevron,
  CompletedAtCell,
  DeedCell,
  GroupHeaderRow,
  MobileGroupHeader,
  MobileTotalsCard,
  RevenueTableHead,
  TotalsBlankCell,
  TotalsLabelCell,
  TotalsValueCell,
} from "./FinanceRevenueTableParts";

type InvoiceGroup = ReturnType<typeof groupRowsByInvoice>[number];

/** Per-invoice facts both layouts show in the group header. */
function invoiceGroupMeta(group: InvoiceGroup) {
  const first = group.rows[0];
  return {
    age: (first ? rowAgeDays(first) : null) ?? 0,
    fu: first?.followupCount ?? 0,
    po: first?.poNumber ?? "",
    sums: sumRevenueAmounts(group.rows),
  };
}

/** «فاتورة …» + «N معاملة · الإجمالي … · عمر المستحق» (desktop header row and phone header). */
function InvoiceGroupTitle({ group }: { group: InvoiceGroup }) {
  const { age, fu, sums } = invoiceGroupMeta(group);
  return (
    <>
      <span className="text-[12.5px] font-extrabold text-heading">
        فاتورة <span dir="ltr">{group.invoiceNumber}</span>
      </span>
      <span className="text-[11px] text-text-3">
        {group.rows.length} معاملة · الإجمالي{" "}
        <b className="text-heading" dir="ltr">
          {fmt(sums.gross, 2)}
        </b>{" "}
        ر.س · عمر المستحق {age} يوماً
        {followupSuffix(fu)}
      </span>
    </>
  );
}

/** «تسجيل التحويل» + follow-up for one invoice (desktop header row and phone header). */
function InvoiceGroupActions({
  po,
  fu,
  onCollect,
  onFollow,
}: {
  po: string;
  fu: number;
  onCollect: (po: string) => void;
  onFollow: (po: string) => void;
}) {
  return (
    <>
      <button
        type="button"
        className={cn(opsBtnPrimary, "px-3 py-[7px] text-[11.5px]")}
        data-po-intent={po}
        onClick={() => onCollect(po)}
      >
        تسجيل التحويل
      </button>
      <button
        type="button"
        className={cn(opsBtnGhost, "h-auto px-[11px] py-[7px] text-[11.5px]")}
        data-po-intent={po}
        onClick={() => onFollow(po)}
      >
        {followButtonLabel(fu)}
      </button>
    </>
  );
}

export function CollectionTable({
  rows,
  collapsed,
  onToggleGroup,
  onCollect,
  onFollow,
}: {
  rows: EnfazTrackingRowDto[];
  collapsed: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  onCollect: (po: string) => void;
  onFollow: (po: string) => void;
}) {
  const colSpan = 5;
  const groups = useMemo(() => groupRowsByInvoice(rows), [rows]);

  return (
    <>
    {/* Phones: a collapsible header per invoice (with its actions) over one card per deed and a totals card. */}
    <div className="flex min-w-0 flex-col gap-2.5 lg:hidden">
      {groups.map((group) => {
        const key = group.invoiceKey;
        const open = collapsed[key] === true;
        const { fu, po, sums } = invoiceGroupMeta(group);
        return (
          <div key={key} className="flex min-w-0 flex-col gap-2">
            <MobileGroupHeader
              open={open}
              onToggle={() => onToggleGroup(key)}
              actions={
                <InvoiceGroupActions
                  po={po}
                  fu={fu}
                  onCollect={onCollect}
                  onFollow={onFollow}
                />
              }
            >
              <InvoiceGroupTitle group={group} />
            </MobileGroupHeader>
            {open ? (
              <MobileRecordList>
                {group.rows.map((row) => {
                  const a = revenueAmountsFromRow(row);
                  return (
                    <MobileRecordCard
                      key={row.propertyId}
                      title={<DeedCell deed={row.deedNumber} />}
                      fields={[
                        { label: "تاريخ الاكتمال", ltr: true, value: formatDateEn(row.completedAtUtc) },
                        { label: "الأتعاب", ltr: true, value: fmt(a.taxable, 2) },
                        { label: "الضريبة", ltr: true, value: fmt(a.vat, 2) },
                        { label: "الإجمالي المستحق", ltr: true, value: fmt(a.total, 2) },
                      ]}
                    />
                  );
                })}
                <MobileTotalsCard
                  title="إجمالي الفاتورة"
                  fields={[
                    { label: "الأتعاب", ltr: true, value: fmt(sums.base, 2) },
                    { label: "الضريبة", ltr: true, value: fmt(sums.vat, 2) },
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
      <Table className="min-w-[720px]">
        <RevenueTableHead
          heads={[
            "رقم الصك",
            "تاريخ الاكتمال",
            "الأتعاب",
            "الضريبة",
            "الإجمالي المستحق",
          ]}
        />
        <TBody>
          {groups.map((group) => {
            const key = group.invoiceKey;
            const open = collapsed[key] === true;
            const { fu, po, sums } = invoiceGroupMeta(group);
            return (
              <Fragment key={key}>
                <GroupHeaderRow colSpan={colSpan} onToggle={() => onToggleGroup(key)}>
                  <div className="flex w-full flex-wrap items-center justify-between gap-2.5">
                    <span className="inline-flex flex-wrap items-center gap-[9px]">
                      <Chevron open={open} />
                      <InvoiceGroupTitle group={group} />
                    </span>
                    <span
                      className="ms-auto inline-flex flex-wrap gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <InvoiceGroupActions
                        po={po}
                        fu={fu}
                        onCollect={onCollect}
                        onFollow={onFollow}
                      />
                    </span>
                  </div>
                </GroupHeaderRow>
                {open
                  ? group.rows.map((row) => {
                      const a = revenueAmountsFromRow(row);
                      return (
                        <Tr key={row.propertyId}>
                          <Td className="text-center">
                            <DeedCell deed={row.deedNumber} />
                          </Td>
                          <CompletedAtCell iso={row.completedAtUtc} />
                          <TdLtr className="text-center" valueClassName="text-xs text-text">
                            {fmt(a.taxable, 2)}
                          </TdLtr>
                          <TdLtr className="text-center" valueClassName={finMuted}>
                            {fmt(a.vat, 2)}
                          </TdLtr>
                          <TdLtr
                            className="text-center"
                            valueClassName="text-[12.5px] font-bold text-heading"
                          >
                            {fmt(a.total, 2)}
                          </TdLtr>
                        </Tr>
                      );
                    })
                  : null}
                {open ? (
                  <Tr hoverable={false}>
                    <TotalsLabelCell>إجمالي الفاتورة</TotalsLabelCell>
                    <TotalsBlankCell />
                    <TotalsValueCell valueClassName="text-[11.5px] font-bold text-text">
                      {fmt(sums.base, 2)}
                    </TotalsValueCell>
                    <TotalsValueCell valueClassName="text-[11.5px] font-bold text-text-2">
                      {fmt(sums.vat, 2)}
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
