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
  cn,
  formatPoDisplay,
  queueTableRowClassName,
} from "@platform/ui-kit";
import { PROPERTY_IDENTIFIER_COLUMN_LABEL } from "@platform/app-shared/domain/property-labels";
import { isActiveFailureStatus } from "@platform/app-shared/failures/failures-types";
import {
  failureActorLabel,
  failureListSeverityLabel,
  failureListStatusColor,
  failureListStatusLabel,
} from "../lib/failures-labels";
import { failureRowTitle, failuresEmptyLine } from "../lib/failures-view-state";
import { FailuresViewExpandedActions } from "./FailuresViewExpandedActions";
import type { FailuresViewWorkflow } from "./useFailuresViewWorkflow";

export function FailuresViewTable({ wf }: { wf: FailuresViewWorkflow }) {
  // After hydration mount only one tree (table or cards) — both used to build together.
  if (wf.isDesktopViewport === false) return null;
  const { rows, isFetched, expandedId, highlightId } = wf;
  return (
    <div className="hidden lg:block">
      <Table framed pending={!isFetched}>
        <THead>
          <Tr hoverable={false}>
            <Th className="text-start">{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
            <Th className="text-start">أمر العمل</Th>
            <Th className="text-start">الخطورة</Th>
            <Th className="text-start">الحالة</Th>
            <Th className="text-start">الرافع</Th>
            <Th className="text-start">الأخصائي</Th>
          </Tr>
        </THead>
        <TBody>
          {!isFetched ? (
            <SkeletonTableRows rows={6} cols={6} />
          ) : rows.length === 0 ? (
            <Tr hoverable={false}>
              <Td colSpan={6} className="cursor-default py-10">
                <EmptyState line={failuresEmptyLine(wf.role)} />
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
                    <Td>
                      <span className="text-[13.5px] font-bold text-primary">
                        {failureRowTitle(f)}
                      </span>
                    </Td>
                    <Td className="font-semibold text-text-2">
                      {formatPoDisplay(f.poNumber)}
                    </Td>
                    <Td className="text-[13px] font-semibold text-heading">
                      {failureListSeverityLabel(f.severity)}
                    </Td>
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
                      {failureActorLabel(f.specialist)}
                    </Td>
                  </Tr>
                  {expanded ? (
                    <Tr hoverable={false}>
                      <Td colSpan={6} className="cursor-default p-0">
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
