"use client";

/**
 * Property-appraisal branch of the active-transaction queue (Case Study.html
 * `VAL`): gold deed cell that opens the property detail, location, PO,
 * assignment date, the stacked party avatars with their hover card, and the
 * appraiser status pill. Rows are prebuilt in meta.
 */
import { memo } from "react";
import {
  cn,
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
import { HoverPortalCard } from "../components/ui/HoverPortalCard";
import type { PrimaryQueueRowMeta } from "../lib/app-data/active-queue-list-filters";
import { PROPERTY_IDENTIFIER_COLUMN_LABEL } from "../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../lib/app-data/tasks-storage";
import {
  appraiserInspectionDone,
  appraiserNeedsSurvey,
  appraiserQueueStatusBadge,
  appraiserSurveyDone,
} from "../lib/evaluator-bridge";
import {
  assignedDateLabel,
  buildAppraisalPartyDeps,
  engSurveyStatusPillStyle,
  joinCityDistrict,
  PARTY_QUEUE_SKELETON_COLS,
  propertyTypeLabel,
  type AppraisalPartyDep,
  type QueueRowContext,
} from "./active-transaction-queue-tables-state";
import {
  PartyQueueDeedCell,
  PropertyDetailTrigger,
  queueRowClassName,
  QueueRowMoreCell,
} from "./active-transaction-queue-row-parts";

type OpenPropertyDetail = (
  task: WorkflowTask,
  propertyId: string | undefined,
) => void;

/* Two static icons in the parties card — were rebuilt per party per row per
   render despite taking no inputs (rendering-hoist-jsx). */
const PARTY_DEP_DONE_ICON = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#2f7a4d"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="m5 13 4 4L19 7" />
  </svg>
);
const PARTY_DEP_PENDING_ICON = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#9aa0ab"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

function partyDepBackground(dep: AppraisalPartyDep): string {
  return dep.ink ? "var(--ink, #102B4E)" : "var(--gold-d, #8c7857)";
}

/** Stacked party avatars; the hover card lists each party and its progress. */
function PartyDepsCell({ deps }: { deps: AppraisalPartyDep[] }) {
  return (
    <HoverPortalCard
      align="start"
      triggerClassName="inline-flex"
      panelClassName="flex min-w-[240px] flex-col gap-1 rounded-[11px] border border-border-md bg-surface p-2.5 shadow-[0_12px_30px_-8px_rgba(18,40,70,.25)]"
      content={
        <>
          <span className="mb-1 px-1 text-[11px] font-bold text-text-3">
            أطراف المعاملة ({deps.length})
          </span>
          {deps.map((dep) => (
            <div
              key={dep.role}
              className={cn(
                "flex items-center gap-2 rounded-md px-1 py-1",
                !dep.ok && "opacity-50",
              )}
            >
              <span
                className="grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                style={{ background: partyDepBackground(dep) }}
              >
                {dep.letter}
              </span>
              <span className="inline-flex min-w-0 flex-col">
                <span className="text-[12.5px] font-semibold text-heading">
                  {dep.name}
                </span>
                <span className="whitespace-nowrap text-[10.5px] text-text-3">
                  {dep.role}
                </span>
              </span>
              <span className="ms-auto">
                {dep.ok ? PARTY_DEP_DONE_ICON : PARTY_DEP_PENDING_ICON}
              </span>
            </div>
          ))}
        </>
      }
    >
      <span className="team inline-flex items-center">
        {deps.map((dep, i) => (
          <span
            key={dep.role}
            className="grid size-7 place-items-center rounded-full border-2 border-surface text-[11px] font-bold text-white"
            style={{
              background: partyDepBackground(dep),
              marginInlineStart: i === 0 ? 0 : -8,
              opacity: dep.ok ? 1 : 0.35,
            }}
          >
            {dep.letter}
          </span>
        ))}
      </span>
    </HoverPortalCard>
  );
}

const PropertyAppraisalRow = memo(function PropertyAppraisalRow({
  ctx,
  meta,
  tasks,
  openPropertyDetail,
}: {
  ctx: QueueRowContext;
  meta: PrimaryQueueRowMeta;
  tasks: WorkflowTask[];
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
  const deps = buildAppraisalPartyDeps({
    inspected,
    needsSurvey: appraiserNeedsSurvey(task, tasks),
    surveyed: appraiserSurveyDone(task, tasks),
  });
  const deedCell = (
    <PartyQueueDeedCell
      ctx={ctx}
      task={task}
      propertySlot={row.propertySlot}
      propertyType={propertyTypeLabel(property)}
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
      <Td className="overflow-visible text-center">
        <PartyDepsCell deps={deps} />
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
  openPropertyDetail,
  statusColumnLabel,
}: {
  ctx: QueueRowContext;
  filteredMeta: PrimaryQueueRowMeta[];
  tasks: WorkflowTask[];
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
          <SkeletonTableRows rows={6} cols={PARTY_QUEUE_SKELETON_COLS} />
        ) : filteredMeta.length === 0 ? (
          <TableEmptyRow colSpan={PARTY_QUEUE_SKELETON_COLS}>
            لا توجد مهام تقييم مطابقة.
          </TableEmptyRow>
        ) : (
          filteredMeta.map((meta) => (
            <PropertyAppraisalRow
              key={meta.task.id}
              ctx={ctx}
              meta={meta}
              tasks={tasks}
              openPropertyDetail={openPropertyDetail}
            />
          ))
        )}
      </TBody>
    </Table>
  );
}
