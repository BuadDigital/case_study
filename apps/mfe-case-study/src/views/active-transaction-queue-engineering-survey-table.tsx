"use client";

/**
 * Engineering-survey branch of the active-transaction queue (Case Study.html
 * `ENG_ST`): gold deed cell, city/district, contact officer card, assignment
 * date, status pill and the remaining-time cell that pauses without a contact
 * number and stops on a failure/return. Rows are prebuilt in meta.
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
import { HoverPortalCard } from "../components/ui/HoverPortalCard";
import type { PrimaryQueueRowMeta } from "../lib/app-data/active-queue-list-filters";
import { PROPERTY_IDENTIFIER_COLUMN_LABEL } from "../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../lib/app-data/tasks-storage";
import {
  assignedDateLabel,
  engSurveyRemainingMode,
  engSurveyStatusPillStyle,
  formatEngSurveyRemaining,
  joinCityDistrict,
  PARTY_QUEUE_SKELETON_COLS,
  propertyTypeLabel,
  resolveEngSurveyContact,
  type EngSurveyContact,
  type QueueRowContext,
  type QueueStatusBadge,
} from "./active-transaction-queue-tables-state";
import {
  PartyQueueDeedCell,
  queueRowClassName,
  QueueRowMoreCell,
} from "./active-transaction-queue-row-parts";

function ContactOfficerCell({ contact }: { contact: EngSurveyContact }) {
  if (contact.name === "—") {
    return <span className="text-[13px] font-semibold text-heading">—</span>;
  }
  return (
    <HoverPortalCard
      align="start"
      triggerClassName="inline-flex"
      panelClassName="flex min-w-[220px] flex-col gap-1.5 rounded-[11px] border border-border-md bg-surface p-3 shadow-[0_12px_30px_-8px_rgba(18,40,70,.25)]"
      content={
        <>
          <span className="text-[12.5px] font-bold text-heading">
            {contact.name}
          </span>
          {contact.role ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-text-2">
              {contact.role}
            </span>
          ) : null}
          <span
            dir="ltr"
            className="inline-flex items-center justify-end gap-1.5 text-[12px] text-text-2"
          >
            {contact.phone ? (
              contact.phone
            ) : (
              <span className="font-bold text-[#a5432e]">
                لا يوجد رقم اتصال
              </span>
            )}
          </span>
        </>
      }
    >
      <span className="border-b border-dashed border-border-md pb-px text-[13px] font-semibold text-heading">
        {contact.name}
      </span>
    </HoverPortalCard>
  );
}

function RemainingCellBody({
  mode,
  text,
}: {
  mode: ReturnType<typeof engSurveyRemainingMode>;
  text: string;
}) {
  if (mode === "paused") {
    return (
      <span className="inline-flex flex-col gap-px">
        <span className="text-text-3">معلّق</span>
        <span className="text-[10.5px] font-medium text-text-3">
          لا يُحتسب الوقت
        </span>
      </span>
    );
  }
  if (mode === "stopped") {
    return (
      <span className="inline-flex flex-col gap-px">
        <span className="text-text-3">متوقف</span>
        <span className="text-[10.5px] font-medium text-text-3">
          بانتظار معالجة التعذر
        </span>
      </span>
    );
  }
  return <>{text}</>;
}

const EngineeringSurveyRow = memo(function EngineeringSurveyRow({
  ctx,
  meta,
  resolveTaskBadge,
}: {
  ctx: QueueRowContext;
  meta: PrimaryQueueRowMeta;
  resolveTaskBadge: (task: WorkflowTask) => QueueStatusBadge;
}) {
  const { task, record, property, row } = meta;
  const active = ctx.selectedId === task.id;
  const moreItems = ctx.resolveRowMoreItems(task, property?.id);
  const contact = resolveEngSurveyContact(property?.contacts);
  const cityDistrict = joinCityDistrict(row.city, row.district);
  const assignedLabel = assignedDateLabel(task, record);
  const badge = resolveTaskBadge(task);
  const statusLabel = badge?.label ?? "—";
  const statusClass = badge?.className ?? "b-new";
  const remaining = formatEngSurveyRemaining(row.remainingTime);
  const remainingMode = engSurveyRemainingMode(contact.missingPhone, statusClass);
  return (
    <Tr
      hoverable={false}
      className={queueRowClassName({
        active,
        opening: ctx.isTaskOpening(task.id),
        dimmed: contact.missingPhone,
      })}
      onClick={() => ctx.handleRowClick(task.id)}
    >
      <Td className="whitespace-nowrap">
        <PartyQueueDeedCell
          ctx={ctx}
          task={task}
          propertySlot={row.propertySlot}
          propertyType={propertyTypeLabel(property)}
        />
      </Td>
      <Td className="text-[13px] text-text-2">{cityDistrict || "—"}</Td>
      <Td className="overflow-visible">
        <ContactOfficerCell contact={contact} />
      </Td>
      <TdLtr
        className="whitespace-nowrap text-[12.5px] text-text-2"
        valueClassName="tabular-nums"
      >
        {assignedLabel}
      </TdLtr>
      <Td>
        <div className="flex flex-col items-start gap-1">
          <StatusPill
            label={statusLabel}
            style={engSurveyStatusPillStyle(statusClass)}
          />
          {contact.missingPhone ? (
            <span className="whitespace-nowrap rounded-md border border-[color-mix(in_srgb,#d9694f_28%,transparent)] bg-[color-mix(in_srgb,#d9694f_10%,transparent)] px-[7px] py-0.5 text-[10.5px] font-bold text-[#a5432e]">
              بلا رقم اتصال
            </span>
          ) : null}
        </div>
      </Td>
      <Td
        className={cn(
          "text-[13px] font-semibold",
          remaining.overdue ? "text-[#d9694f]" : "text-heading",
        )}
      >
        <RemainingCellBody mode={remainingMode} text={remaining.text} />
      </Td>
      <QueueRowMoreCell items={moreItems} />
    </Tr>
  );
});

export function EngineeringSurveyQueueTable({
  ctx,
  filteredMeta,
  resolveTaskBadge,
  statusColumnLabel,
}: {
  ctx: QueueRowContext;
  filteredMeta: PrimaryQueueRowMeta[];
  resolveTaskBadge: (task: WorkflowTask) => QueueStatusBadge;
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
          <Th>المدينة / الحي</Th>
          <Th>ضابط الاتصال</Th>
          <Th>تاريخ الإسناد</Th>
          <Th>{statusColumnLabel ?? "الحالة"}</Th>
          <Th>المتبقي</Th>
          <ThAction aria-label="إجراءات" />
        </Tr>
      </THead>
      <TBody>
        {ctx.showSkeleton ? (
          <SkeletonTableRows rows={6} cols={PARTY_QUEUE_SKELETON_COLS} />
        ) : filteredMeta.length === 0 ? (
          <TableEmptyRow colSpan={PARTY_QUEUE_SKELETON_COLS}>
            لا توجد أوامر رفع مطابقة.
          </TableEmptyRow>
        ) : (
          filteredMeta.map((meta) => (
            <EngineeringSurveyRow
              key={meta.task.id}
              ctx={ctx}
              meta={meta}
              resolveTaskBadge={resolveTaskBadge}
            />
          ))
        )}
      </TBody>
    </Table>
  );
}
