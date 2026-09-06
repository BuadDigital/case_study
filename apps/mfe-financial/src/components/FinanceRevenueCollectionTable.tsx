"use client";

/** Revenue stage «بانتظار التحصيل» — rows grouped under their invoice with collect / follow-up actions. */

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
  opsBtnGhost,
  opsBtnPrimary,
} from "@platform/ui-kit";
import {
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
  RevenueTableHead,
  TotalsBlankCell,
  TotalsLabelCell,
  TotalsValueCell,
} from "./FinanceRevenueTableParts";

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
    <TableFrame>
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
            const iv = group.invoiceNumber;
            const age = rowAgeDays(group.rows[0]!) ?? 0;
            const fu = group.rows[0]?.followupCount ?? 0;
            const po = group.rows[0]?.poNumber ?? "";
            const sums = sumRevenueAmounts(group.rows);
            return (
              <Fragment key={key}>
                <GroupHeaderRow colSpan={colSpan} onToggle={() => onToggleGroup(key)}>
                  <div className="flex w-full flex-wrap items-center justify-between gap-2.5">
                    <span className="inline-flex flex-wrap items-center gap-[9px]">
                      <Chevron open={open} />
                      <span className="text-[12.5px] font-extrabold text-heading">
                        فاتورة <span dir="ltr">{iv}</span>
                      </span>
                      <span className="text-[11px] text-text-3">
                        {group.rows.length} معاملة · الإجمالي{" "}
                        <b className="text-heading" dir="ltr">
                          {fmt(sums.gross, 2)}
                        </b>{" "}
                        ر.س · عمر المستحق {age} يوماً
                        {followupSuffix(fu)}
                      </span>
                    </span>
                    <span
                      className="ms-auto inline-flex flex-wrap gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className={cn(opsBtnPrimary, "px-3 py-[7px] text-[11.5px]")}
                        onClick={() => onCollect(po)}
                      >
                        تسجيل التحويل
                      </button>
                      <button
                        type="button"
                        className={cn(
                          opsBtnGhost,
                          "h-auto px-[11px] py-[7px] text-[11.5px]",
                        )}
                        onClick={() => onFollow(po)}
                      >
                        {followButtonLabel(fu)}
                      </button>
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
  );
}
