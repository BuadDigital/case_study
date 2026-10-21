"use client";

/** Revenue stage «تحت الدراسة» — rows grouped under their work order, «X of Y» from the whole set. */

import { Fragment, useMemo } from "react";
import { fmt, fmtSar } from "@platform/app-shared/format/number";
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
  finStatusStyle,
} from "@platform/ui-kit";
import { revenueAmountsFromRow } from "../lib/finance-revenue-stages";
import {
  knownFeesTotal,
  rowsPerPo,
  studyGroups,
  studyPropertyCaption,
  studyRowStatus,
} from "../lib/finance-revenue-state";
import { finNum } from "../lib/finance-tw";
import {
  Chevron,
  CityCell,
  CompletedAtCell,
  DeedCell,
  FeeFlags,
  GroupHeaderRow,
  MobileGroupHeader,
  RevenueTableHead,
  revenueCityDateFields,
} from "./FinanceRevenueTableParts";

/** Fee flags + total, «—» while unknown (table cell and phone card). */
function StudyFeesValue({ row }: { row: EnfazTrackingRowDto }) {
  const total = revenueAmountsFromRow(row).total;
  return (
    <span className="inline-flex items-center gap-2.5">
      <FeeFlags row={row} />
      <span className={finNum}>
        {total > 0 ? fmtSar(total, { trim: "whole" }) : "—"}
      </span>
    </span>
  );
}

/** Group caption — «قيد الدراسة X من Y … أتعاب» (desktop header row and phone header). */
function StudyGroupCaption({
  studyInPo,
  totalInPo,
  feesSum,
  feesKnown,
}: {
  studyInPo: number;
  totalInPo: number;
  feesSum: number;
  feesKnown: boolean;
}) {
  return (
    <span className="text-[11px] leading-snug text-text-3">
      قيد الدراسة {studyInPo} من {totalInPo} معاملة في الطلب
      {" — "}
      أتعاب{" "}
      <b className="font-bold text-heading" dir="ltr">
        {feesKnown ? fmt(feesSum, 2) : "—"}
      </b>{" "}
      ر.س
    </span>
  );
}

export function StudyTable({
  rows,
  allRows,
  collapsed,
  onToggleGroup,
}: {
  rows: EnfazTrackingRowDto[];
  /** All tracking rows — for «X of Y» inside a work order */
  allRows: EnfazTrackingRowDto[];
  collapsed: Record<string, boolean>;
  onToggleGroup: (po: string) => void;
}) {
  const colSpan = 4;
  const poTotals = useMemo(() => rowsPerPo(allRows), [allRows]);
  const groups = useMemo(() => studyGroups(rows), [rows]);

  return (
    <>
    {/* Phones: a collapsible header per work order over one card per deed. */}
    <div className="flex min-w-0 flex-col gap-2.5 lg:hidden">
      {groups.map(({ poNumber, rows: group }) => {
        const open = collapsed[poNumber] === true;
        const { feesSum, feesKnown } = knownFeesTotal(group);
        return (
          <div key={poNumber} className="flex min-w-0 flex-col gap-2">
            <MobileGroupHeader open={open} onToggle={() => onToggleGroup(poNumber)}>
              <span className="text-[13px] font-extrabold text-heading">
                أمر العمل{" "}
                <span className="text-gold-d" dir="ltr">
                  {poNumber}
                </span>
              </span>
              <StudyGroupCaption
                studyInPo={group.length}
                totalInPo={poTotals.get(poNumber) ?? group.length}
                feesSum={feesSum}
                feesKnown={feesKnown}
              />
            </MobileGroupHeader>
            {open ? (
              <MobileRecordList>
                {group.map((row) => {
                  const status = studyRowStatus(row);
                  return (
                    <MobileRecordCard
                      key={`${row.poNumber}-${row.propertyId}`}
                      title={<DeedCell deed={row.deedNumber} />}
                      subtitle={studyPropertyCaption(row) || undefined}
                      status={
                        <StatusPill
                          label={status.label}
                          style={finStatusStyle(status.tone)}
                        />
                      }
                      fields={[
                        ...revenueCityDateFields(row),
                        {
                          label: "إجمالي الأتعاب",
                          value: <StudyFeesValue row={row} />,
                          wide: true,
                        },
                      ]}
                    />
                  );
                })}
              </MobileRecordList>
            ) : null}
          </div>
        );
      })}
    </div>
    <TableFrame className="max-lg:hidden">
      <Table className="min-w-[780px]">
        <RevenueTableHead
          heads={[
            "رقم الصك",
            "المدينة",
            "تاريخ الاكتمال",
            "إجمالي الأتعاب",
          ]}
        />
        <TBody>
          {groups.map(({ poNumber, rows: group }) => {
            const open = collapsed[poNumber] === true;
            const totalInPo = poTotals.get(poNumber) ?? group.length;
            const studyInPo = group.length;
            const { feesSum, feesKnown } = knownFeesTotal(group);

            return (
              <Fragment key={poNumber}>
                <GroupHeaderRow
                  colSpan={colSpan}
                  onToggle={() => onToggleGroup(poNumber)}
                >
                  <div className="flex w-full min-w-0 flex-wrap items-center gap-[9px]">
                    <span className="inline-flex min-w-0 flex-wrap items-center gap-[9px]">
                      <Chevron open={open} />
                      <span className="text-[12.5px] font-extrabold text-heading">
                        أمر العمل{" "}
                        <span className="text-gold-d" dir="ltr">
                          {poNumber}
                        </span>
                      </span>
                      <StudyGroupCaption
                        studyInPo={studyInPo}
                        totalInPo={totalInPo}
                        feesSum={feesSum}
                        feesKnown={feesKnown}
                      />
                    </span>
                  </div>
                </GroupHeaderRow>

                {open
                  ? group.map((row) => {
                      const status = studyRowStatus(row);
                      const caption = studyPropertyCaption(row);
                      return (
                        <Tr key={`${row.poNumber}-${row.propertyId}`}>
                          <Td>
                            <div className="flex min-w-0 flex-col items-start gap-1">
                              <DeedCell deed={row.deedNumber} />
                              {caption ? (
                                <span className="max-w-full truncate text-[11px] leading-snug text-text-3">
                                  {caption}
                                </span>
                              ) : null}
                            </div>
                          </Td>
                          <CityCell row={row} />
                          <CompletedAtCell iso={row.completedAtUtc} />
                          <Td className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              <StudyFeesValue row={row} />
                              <StatusPill
                                label={status.label}
                                style={finStatusStyle(status.tone)}
                              />
                            </div>
                          </Td>
                        </Tr>
                      );
                    })
                  : null}
              </Fragment>
            );
          })}
        </TBody>
      </Table>
    </TableFrame>
    </>
  );
}
