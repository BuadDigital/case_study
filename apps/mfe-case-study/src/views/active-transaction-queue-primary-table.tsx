"use client";

/**
 * Primary-data (default) branch of the active-transaction queue: deed, PO,
 * assignment type, optional city/district, then the status-or-remaining cell
 * the screen renders. Rows are prebuilt in meta — no rebuild every render.
 */
import { memo, type ReactNode } from "react";
import {
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  Th,
  ThAction,
  THead,
  Tr,
} from "@platform/ui-kit";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import { InteractiveDeedCell } from "../components/ui/InteractiveDeedCell";
import type { RemainingTimeState } from "../lib/app-data/my-task-row";
import type { PrimaryQueueRowMeta } from "../lib/app-data/active-queue-list-filters";
import { PROPERTY_IDENTIFIER_COLUMN_LABEL } from "../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../lib/app-data/tasks-storage";
import {
  isStudySlotLabel,
  primarySkeletonCols,
  type QueueRowContext,
} from "./active-transaction-queue-tables-state";
import {
  queueRowClassName,
  QueueRowMoreCell,
} from "./active-transaction-queue-row-parts";

type RenderStatusOrRemaining = (
  task: WorkflowTask,
  remainingTime: RemainingTimeState,
) => ReactNode;

/* Rows are memoized: ctx is useMemo'd in the screen and meta comes from a memoized array,
   so the row does not re-render on every search keystroke or minute tick (rerender-memo). */
const PrimaryQueueRow = memo(function PrimaryQueueRow({
  ctx,
  meta,
  primaryHasLocation,
  renderStatusOrRemaining,
}: {
  ctx: QueueRowContext;
  meta: PrimaryQueueRowMeta;
  primaryHasLocation: boolean;
  renderStatusOrRemaining: RenderStatusOrRemaining;
}) {
  const { task, property, row } = meta;
  const active = ctx.selectedId === task.id;
  const moreItems = ctx.resolveRowMoreItems(task, property?.id);
  const isStudyLabel = isStudySlotLabel(row.propertySlot);
  return (
    <Tr
      hoverable={false}
      className={queueRowClassName({
        active,
        opening: ctx.isTaskOpening(task.id),
      })}
      onClick={() => ctx.handleRowClick(task.id)}
    >
      <Td className="whitespace-nowrap">
        <InteractiveDeedCell
          label={row.propertySlot}
          loading={ctx.isTaskOpening(task.id)}
          tone={isStudyLabel ? "gold" : "primary"}
          rtl={isStudyLabel}
        />
      </Td>
      <Td className="text-text-2">
        <PoNumber
          value={task.poNumber}
          link
          className="!text-[12.5px] !font-semibold text-text-2"
        />
      </Td>
      <Td className="text-text-2">{row.assignmentType}</Td>
      {primaryHasLocation ? (
        <>
          <Td className="text-text-2">{row.city}</Td>
          <Td className="text-text-2">{row.district}</Td>
        </>
      ) : null}
      <Td className="text-text-2">
        {renderStatusOrRemaining(task, row.remainingTime)}
      </Td>
      <QueueRowMoreCell items={moreItems} />
    </Tr>
  );
});

export function PrimaryQueueTable({
  ctx,
  filteredMeta,
  primaryHasLocation,
  renderStatusOrRemaining,
  statusColumnLabel,
}: {
  ctx: QueueRowContext;
  filteredMeta: PrimaryQueueRowMeta[];
  primaryHasLocation: boolean;
  renderStatusOrRemaining: RenderStatusOrRemaining;
  statusColumnLabel: string | undefined;
}) {
  return (
    <Table className="w-full" pending={ctx.queuePending}>
      <THead>
        <Tr hoverable={false}>
          <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
          <Th>أمر العمل</Th>
          <Th>نوع الإسناد</Th>
          {primaryHasLocation ? (
            <>
              <Th>المدينة</Th>
              <Th>الحي</Th>
            </>
          ) : null}
          <Th>{statusColumnLabel ?? "الحالة"}</Th>
          <ThAction aria-label="المزيد" />
        </Tr>
      </THead>
      <TBody>
        {ctx.showSkeleton ? (
          <SkeletonTableRows
            rows={6}
            cols={primarySkeletonCols(primaryHasLocation)}
          />
        ) : (
          filteredMeta.map((meta) => (
            <PrimaryQueueRow
              key={meta.task.id}
              ctx={ctx}
              meta={meta}
              primaryHasLocation={primaryHasLocation}
              renderStatusOrRemaining={renderStatusOrRemaining}
            />
          ))
        )}
      </TBody>
    </Table>
  );
}
