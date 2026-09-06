"use client";

/**
 * Distribution / case-study branch of the active-transaction queue: ordinal +
 * deed, PO, location and property columns, plus the three party-assignee
 * columns when the layout shows them. Rows are memoized against the screen's `ctx`.
 */
import { memo } from "react";
import {
  cn,
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
import { PartyAssigneeCell } from "../components/ui/PartyAssigneeCell";
import {
  buildDistributionTableRow,
  findPropertyForTask,
} from "../lib/app-data/my-task-row";
import { INSPECTION_TABLE_TYPE } from "../lib/app-data/queue-table-type";
import type { PoIntakeRecord } from "../lib/app-data/po-intake-data";
import { PROPERTY_IDENTIFIER_COLUMN_LABEL } from "../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../lib/app-data/tasks-storage";
import { buildCaseStudyPartyAssignees } from "../lib/app-data/case-study-tracks";
import {
  distributionSkeletonCols,
  EMPTY_PARTY_PROGRESS,
  type PartyProgressByTask,
  type QueueRowContext,
} from "./active-transaction-queue-tables-state";
import {
  PropertyDetailTrigger,
  queueRowClassName,
  QueueRowMoreCell,
  rowAttentionTrailing,
} from "./active-transaction-queue-row-parts";

type StaffUsers = Parameters<typeof buildCaseStudyPartyAssignees>[3];
type OpenPropertyDetail = (
  task: WorkflowTask,
  propertyId: string | undefined,
) => void;

const DistributionQueueRow = memo(function DistributionQueueRow({
  ctx,
  task,
  index,
  record,
  showPartyColumns,
  disableRowOpen,
  tasks,
  partyProgressByTask,
  staffUsers,
  onRowClick,
  openPropertyDetail,
}: {
  ctx: QueueRowContext;
  task: WorkflowTask;
  index: number;
  record: PoIntakeRecord | undefined;
  showPartyColumns: boolean;
  disableRowOpen: boolean;
  tasks: WorkflowTask[];
  partyProgressByTask: PartyProgressByTask;
  staffUsers: StaffUsers;
  onRowClick: (task: WorkflowTask, propertyId: string | undefined) => void;
  openPropertyDetail: OpenPropertyDetail;
}) {
  const property = findPropertyForTask(record, task);
  const row = buildDistributionTableRow(task, property, record);
  const parties = showPartyColumns
    ? buildCaseStudyPartyAssignees(
        task,
        tasks,
        partyProgressByTask.get(task.id) ?? EMPTY_PARTY_PROGRESS,
        staffUsers,
      )
    : [];
  const active = ctx.selectedId === task.id;
  const moreItems = ctx.resolveRowMoreItems(task, property?.id);
  const deedCell = (
    <InteractiveDeedCell
      label={row.deedLabel}
      loading={ctx.isTaskOpening(task.id)}
      labelClassName={INSPECTION_TABLE_TYPE.deed}
      trailing={rowAttentionTrailing(ctx, task)}
    />
  );
  return (
    <Tr
      hoverable={false}
      className={queueRowClassName({
        active,
        opening: ctx.isTaskOpening(task.id),
      })}
      onClick={
        disableRowOpen ? undefined : () => onRowClick(task, property?.id)
      }
    >
      <Td className="whitespace-nowrap">
        <span className="inline-flex min-w-0 items-center justify-end gap-2">
          <span
            className={cn(
              "inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-md bg-surface-3 tabular-nums",
              INSPECTION_TABLE_TYPE.ordinal,
            )}
            aria-hidden
          >
            {index + 1}
          </span>
          {property?.id ? (
            <PropertyDetailTrigger
              onOpen={() => openPropertyDetail(task, property.id)}
            >
              {deedCell}
            </PropertyDetailTrigger>
          ) : (
            deedCell
          )}
        </span>
      </Td>
      <Td className={INSPECTION_TABLE_TYPE.body}>
        <PoNumber
          value={task.poNumber}
          link
          className={INSPECTION_TABLE_TYPE.po}
        />
      </Td>
      <Td className={INSPECTION_TABLE_TYPE.body}>{row.city}</Td>
      <Td className={INSPECTION_TABLE_TYPE.body}>{row.district}</Td>
      <Td className={INSPECTION_TABLE_TYPE.body}>{row.propertyType}</Td>
      <Td className={INSPECTION_TABLE_TYPE.body}>{row.classification}</Td>
      <Td className={INSPECTION_TABLE_TYPE.body}>{row.area}</Td>
      {showPartyColumns
        ? parties.map((party) => (
            <Td
              key={party.trackId}
              className={cn(
                "w-[7.5rem] min-w-[7.5rem] overflow-hidden",
                INSPECTION_TABLE_TYPE.body,
              )}
            >
              <PartyAssigneeCell party={party} />
            </Td>
          ))
        : null}
      <QueueRowMoreCell items={moreItems} />
    </Tr>
  );
});

export function DistributionQueueTable({
  ctx,
  showPartyColumns,
  disableRowOpen,
  filteredListed,
  poByNumber,
  tasks,
  partyProgressByTask,
  staffUsers,
  onRowClick,
  openPropertyDetail,
}: {
  ctx: QueueRowContext;
  showPartyColumns: boolean;
  disableRowOpen: boolean;
  filteredListed: WorkflowTask[];
  poByNumber: Map<string, PoIntakeRecord>;
  tasks: WorkflowTask[];
  partyProgressByTask: PartyProgressByTask;
  staffUsers: StaffUsers;
  onRowClick: (task: WorkflowTask, propertyId: string | undefined) => void;
  openPropertyDetail: OpenPropertyDetail;
}) {
  return (
    <Table
      className={cn(
        "w-full",
        showPartyColumns ? "min-w-0" : "lg:min-w-[720px]",
      )}
      pending={ctx.queuePending}
    >
      <THead>
        <Tr hoverable={false}>
          <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
          <Th>أمر العمل</Th>
          <Th>المدينة</Th>
          <Th>الحي</Th>
          <Th>نوع العقار</Th>
          <Th>التصنيف</Th>
          <Th>المساحة</Th>
          {showPartyColumns ? (
            <>
              <Th className="w-[7.5rem] min-w-[7.5rem]">المكتب الهندسي</Th>
              <Th className="w-[7.5rem] min-w-[7.5rem]">المعاين</Th>
              <Th className="w-[7.5rem] min-w-[7.5rem]">المقيم</Th>
            </>
          ) : null}
          <ThAction aria-label="المزيد" />
        </Tr>
      </THead>
      <TBody>
        {ctx.showSkeleton ? (
          <SkeletonTableRows
            rows={6}
            cols={distributionSkeletonCols(showPartyColumns)}
          />
        ) : (
          filteredListed.map((task, index) => (
            <DistributionQueueRow
              key={task.id}
              ctx={ctx}
              task={task}
              index={index}
              record={poByNumber.get(task.poNumber.trim())}
              showPartyColumns={showPartyColumns}
              disableRowOpen={disableRowOpen}
              tasks={tasks}
              partyProgressByTask={partyProgressByTask}
              staffUsers={staffUsers}
              onRowClick={onRowClick}
              openPropertyDetail={openPropertyDetail}
            />
          ))
        )}
      </TBody>
    </Table>
  );
}
