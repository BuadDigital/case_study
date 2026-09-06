"use client";

/** Revenue stage «تحت الدراسة» — rows grouped under their work order, «X of Y» from the whole set. */

import { Fragment, useMemo } from "react";
import { fmt } from "@platform/app-shared/format/number";
import type { EnfazTrackingRowDto } from "@platform/api-client";
import {
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
  fmtSar,
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
  RevenueTableHead,
} from "./FinanceRevenueTableParts";

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
    <TableFrame>
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
                      <span className="text-[11px] leading-snug text-text-3">
                        تحت الدراسة {studyInPo} من {totalInPo} معاملة في الطلب
                        {" — "}
                        أتعاب{" "}
                        <b className="font-bold text-heading" dir="ltr">
                          {feesKnown ? fmt(feesSum, 2) : "—"}
                        </b>{" "}
                        ر.س
                      </span>
                    </span>
                  </div>
                </GroupHeaderRow>

                {open
                  ? group.map((row) => {
                      const total = revenueAmountsFromRow(row).total;
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
                              <span className="inline-flex items-center gap-2.5">
                                <FeeFlags row={row} />
                                <span className={finNum}>
                                  {total > 0 ? fmtSar(total) : "—"}
                                </span>
                              </span>
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
  );
}
