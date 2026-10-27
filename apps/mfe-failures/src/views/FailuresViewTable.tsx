"use client";

/** Failures queue — the desktop table; a clicked row expands into `FailuresViewExpandedActions`. */

import { Fragment } from "react";
import {
  EmptyState,
  SkeletonTableRows,
  StatusPill,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  TransactionNumberBadge,
  cn,
  formatPoDisplay,
  queueTableRowClassName,
} from "@platform/ui-kit";
import { dmy } from "@platform/app-shared/format/date";
import { PROPERTY_IDENTIFIER_COLUMN_LABEL } from "@platform/app-shared/domain/property-labels";
import { isActiveFailureStatus } from "@platform/app-shared/failures/failures-types";
import {
  failureActorLabel,
  failureListStatusColor,
  failureListStatusLabel,
  failureRecordTitle,
} from "../lib/failures-labels";
import {
  failureDeedCell,
  failureSpecialistName,
  failuresEmptyLine,
} from "../lib/failures-view-state";
import { FailuresViewExpandedActions } from "./FailuresViewExpandedActions";
import type { FailuresViewWorkflow } from "./useFailuresViewWorkflow";

/**
 * Column order: رقم المعاملة · رقم الصك/التسجيل العيني · أمر العمل · سبب
 * التعذّر · الحالة · مصدر التعذّر · الأخصائي · تاريخ تسجيل التعذّر. The skeleton and the expanded
 * row span all of them, so the count lives here. «الخطورة» was folded into «الحالة»; «الرافع»
 * became «مصدر التعذّر»; the transaction number badge moved to ui-kit to be shared with the
 * case-study queues.
 */
const COLUMNS = 8;

export function FailuresViewTable({ wf }: { wf: FailuresViewWorkflow }) {
  // After hydration mount only one tree (table or cards) — both used to build together.
  if (wf.isDesktopViewport === false) return null;
  const { rows, isFetched, expandedId, highlightId } = wf;
  return (
    <div className="hidden lg:block">
      <Table framed pending={!isFetched}>
        <THead>
          <Tr hoverable={false}>
            <Th className="text-start">رقم المعاملة</Th>
            <Th className="text-start">{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
            <Th className="text-start">أمر العمل</Th>
            <Th className="text-start">سبب التعذّر</Th>
            <Th className="text-start">الحالة</Th>
            <Th className="text-start">مصدر التعذّر</Th>
            <Th className="text-start">الأخصائي</Th>
            <Th className="text-start">تاريخ تسجيل التعذّر</Th>
          </Tr>
        </THead>
        <TBody>
          {!isFetched ? (
            <SkeletonTableRows rows={6} cols={COLUMNS} />
          ) : rows.length === 0 ? (
            <Tr hoverable={false}>
              <Td colSpan={COLUMNS} className="cursor-default py-10">
                <EmptyState line={failuresEmptyLine(wf.role, wf.tab)} />
              </Td>
            </Tr>
          ) : (
            rows.map((f) => {
              const active = isActiveFailureStatus(f.status);
              const statusColor = failureListStatusColor(f.status, f.severity);
              const expanded = expandedId === f.id;
              return (
                <Fragment key={f.id}>
                  <Tr
                    id={`failure-${f.id}`}
                    hoverable={false}
                    className={cn(
                      "group",
                      queueTableRowClassName,
                      !active && "opacity-70",
                      highlightId === f.id && "bg-primary-light/30",
                      expanded && "bg-row-hover",
                    )}
                    onClick={() => wf.toggleExpanded(f.id)}
                  >
                    <Td className="text-text-2">
                      {f.transactionNumber ? (
                        <TransactionNumberBadge
                          number={f.transactionNumber}
                          deedCount={f.transactionDeedCount}
                          className="!text-[13px] !text-text-2"
                        />
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <span className="text-[13.5px] font-bold text-primary [unicode-bidi:isolate]">
                        {failureDeedCell(f)}
                      </span>
                    </Td>
                    <Td className="font-semibold text-text-2">
                      {formatPoDisplay(f.poNumber)}
                    </Td>
                    <Td className="text-[13px] text-heading">{failureRecordTitle(f)}</Td>
                    <Td>
                      <StatusPill
                        label={failureListStatusLabel(f.status, f.severity)}
                        style={{ base: statusColor, fg: statusColor }}
                      />
                    </Td>
                    <Td className="text-text-2">
                      {failureActorLabel(f.raisedByRole)}
                    </Td>
                    <Td className="text-text-2">
                      {failureSpecialistName(f) || "—"}
                    </Td>
                    <Td className="tabular-nums text-text-2">{dmy(f.createdAt)}</Td>
                  </Tr>
                  {expanded ? (
                    <Tr hoverable={false}>
                      <Td colSpan={COLUMNS} className="cursor-default p-0">
                        <FailuresViewExpandedActions failure={f} wf={wf} />
                      </Td>
                    </Tr>
                  ) : null}
                </Fragment>
              );
            })
          )}
        </TBody>
      </Table>
    </div>
  );
}
