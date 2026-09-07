"use client";

/**
 * Property-appraisal branch of the active-transaction queue (Case Study.html
 * `VAL`): gold deed cell that opens the property detail, property type,
 * location, PO, assignment date, assigned main parties, and the appraiser
 * status pill. Rows are prebuilt in meta.
 */
import { memo } from "react";
import {
  SkeletonTableRows,
  StatusPill,
  Table,
  TableEmptyRow,
  TBody,
  Td,
  TdLtr,
  Th,
  ThAction,
  THead,
  Tr,
} from "@platform/ui-kit";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import type { PrimaryQueueRowMeta } from "../lib/app-data/active-queue-list-filters";
import { PROPERTY_IDENTIFIER_COLUMN_LABEL } from "../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../lib/app-data/tasks-storage";
import { buildCaseStudyPartyAssignees } from "../lib/app-data/case-study-tracks";
import {
  appraiserInspectionDone,
  appraiserQueueStatusBadge,
} from "../lib/evaluator-bridge";
import {
  APPRAISAL_QUEUE_SKELETON_COLS,
  assignedDateLabel,
  caseStudyParentForQueueTask,
  EMPTY_PARTY_PROGRESS,
  engSurveyStatusPillStyle,
  joinCityDistrict,
  propertyTypeLabel,
  type PartyProgressByTask,
  type QueueRowContext,
} from "./active-transaction-queue-tables-state";
import {
  PartyQueueDeedCell,
  PropertyDetailTrigger,
  queueRowClassName,
  QueueRowMoreCell,
} from "./active-transaction-queue-row-parts";
import { TeamStack } from "./PoListViewParts";

type OpenPropertyDetail = (
  task: WorkflowTask,
  propertyId: string | undefined,
) => void;

/** Same overlapping-avatar stack as أوامر العمل (PO) «الفريق». */
function AssignedPartiesCell({
  parent,
  tasks,
  progress,
  staffUsers,
}: {
  parent: WorkflowTask;
  tasks: WorkflowTask[];
  progress: typeof EMPTY_PARTY_PROGRESS;
  staffUsers: StaffUser[];
}) {
  const members = buildCaseStudyPartyAssignees(
    parent,
    tasks,
    progress,
    staffUsers,
  )
    .filter((p) => p.enabled)
    .flatMap((p) => {
      const name = p.name.trim();
      if (!name || name === "—") return [];
      return [{ name, role: p.shortLabel }];
    });
  return <TeamStack members={members} />;
}

const PropertyAppraisalRow = memo(function PropertyAppraisalRow({
  ctx,
  meta,
  tasks,
  staffUsers,
  partyProgressByTask,
  openPropertyDetail,
}: {
  ctx: QueueRowContext;
  meta: PrimaryQueueRowMeta;
  tasks: WorkflowTask[];
  staffUsers: StaffUser[];
  partyProgressByTask: PartyProgressByTask;
  openPropertyDetail: OpenPropertyDetail;
}) {
  const { task, record, property, row } = meta;
  const active = ctx.selectedId === task.id;
  const moreItems = ctx.resolveRowMoreItems(task, property?.id);
  const cityDistrict = joinCityDistrict(row.city, row.district);
  const assignedLabel = assignedDateLabel(task, record);
  const badge = appraiserQueueStatusBadge(task, tasks) ?? {
    label: "—",
    className: "b-new",
  };
  const inspected = appraiserInspectionDone(task, tasks);
  const parent = caseStudyParentForQueueTask(task, tasks);
  const typeLabel = propertyTypeLabel(property) || row.propertyType;
  const deedCell = (
    <PartyQueueDeedCell
      ctx={ctx}
      task={task}
      propertySlot={row.propertySlot}
    />
  );
  return (
    <Tr
      hoverable={false}
      className={queueRowClassName({
        active,
        opening: ctx.isTaskOpening(task.id),
        dimmed: !inspected,
      })}
      onClick={() => ctx.handleRowClick(task.id)}
    >
      <Td className="whitespace-nowrap">
        {property?.id ? (
          <PropertyDetailTrigger
            ariaLabel={`تفاصيل العقار ${row.propertySlot}`}
            onOpen={() => openPropertyDetail(task, property.id)}
          >
            {deedCell}
          </PropertyDetailTrigger>
        ) : (
          deedCell
        )}
      </Td>
      <Td className="whitespace-nowrap text-center text-[13px] text-text-2">
        {typeLabel && typeLabel !== "—" ? typeLabel : "—"}
      </Td>
      <Td className="text-center text-[13px] text-text-2">
        {cityDistrict || "—"}
      </Td>
      <Td className="text-[12px] text-text-2">
        <PoNumber value={task.poNumber} link />
      </Td>
      <TdLtr
        className="whitespace-nowrap text-center text-[12.5px] text-text-2"
        valueClassName="tabular-nums"
      >
        {assignedLabel}
      </TdLtr>
      <Td className="overflow-visible whitespace-nowrap">
        <AssignedPartiesCell
          parent={parent}
          tasks={tasks}
          progress={partyProgressByTask.get(parent.id) ?? EMPTY_PARTY_PROGRESS}
          staffUsers={staffUsers}
        />
      </Td>
      <Td className="text-center">
        <StatusPill
          label={badge.label}
          style={engSurveyStatusPillStyle(badge.className)}
        />
      </Td>
      <QueueRowMoreCell items={moreItems} />
    </Tr>
  );
});

export function PropertyAppraisalQueueTable({
  ctx,
  filteredMeta,
  tasks,
  staffUsers,
  partyProgressByTask,
  openPropertyDetail,
  statusColumnLabel,
}: {
  ctx: QueueRowContext;
  filteredMeta: PrimaryQueueRowMeta[];
  tasks: WorkflowTask[];
  staffUsers: StaffUser[];
  partyProgressByTask: PartyProgressByTask;
  openPropertyDetail: OpenPropertyDetail;
  statusColumnLabel: string | undefined;
}) {
  return (
    <Table
      className="w-full"
      pending={ctx.queuePending}
      wrapClassName="min-w-0 overflow-x-auto overflow-y-visible [-webkit-overflow-scrolling:touch]"
    >
      <THead>
        <Tr hoverable={false}>
          <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
          <Th className="text-center">نوع العقار</Th>
          <Th className="text-center">المدينة / الحي</Th>
          <Th>أمر العمل</Th>
          <Th className="text-center">تاريخ الإسناد</Th>
          <Th className="text-center">الأطراف</Th>
          <Th className="text-center">{statusColumnLabel ?? "الحالة"}</Th>
          <ThAction aria-label="إجراءات" />
        </Tr>
      </THead>
      <TBody>
        {ctx.showSkeleton ? (
          <SkeletonTableRows rows={6} cols={APPRAISAL_QUEUE_SKELETON_COLS} />
        ) : filteredMeta.length === 0 ? (
          <TableEmptyRow colSpan={APPRAISAL_QUEUE_SKELETON_COLS}>
            لا توجد مهام تقييم مطابقة.
          </TableEmptyRow>
        ) : (
          filteredMeta.map((meta) => (
            <PropertyAppraisalRow
              key={meta.task.id}
              ctx={ctx}
              meta={meta}
              tasks={tasks}
              staffUsers={staffUsers}
              partyProgressByTask={partyProgressByTask}
              openPropertyDetail={openPropertyDetail}
            />
          ))
        )}
      </TBody>
    </Table>
  );
}
