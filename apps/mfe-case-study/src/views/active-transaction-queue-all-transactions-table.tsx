"use client";

/**
 * "All transactions" branch of the active-transaction queue: flat rows or,
 * when grouped, a collapsible header row per work order that opens the PO's
 * properties page. Rows are memoized against the screen's `ctx` and meta.
 */
import { Fragment, memo } from "react";
import {
  cn,
  SkeletonTableRows,
  StatusPill,
  Table,
  TableEmptyRow,
  TBody,
  Td,
  Th,
  ThAction,
  THead,
  Tr,
} from "@platform/ui-kit";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import { InteractiveDeedCell } from "../components/ui/InteractiveDeedCell";
import { PROPERTY_IDENTIFIER_COLUMN_LABEL } from "../lib/app-data/po-intake-data";
import { allTransactionsPhaseStyle } from "../lib/app-data/all-transactions-queue";
import type { AllTransactionsRowMeta } from "./active-transaction-queue-state";
import {
  ALL_TRANSACTIONS_SKELETON_COLS,
  type QueueRowContext,
} from "./active-transaction-queue-tables-state";
import {
  queueRowClassName,
  QueueRowMoreCell,
  rowAttentionTrailing,
} from "./active-transaction-queue-row-parts";

const AllTransactionsRow = memo(function AllTransactionsRow({
  ctx,
  meta,
}: {
  ctx: QueueRowContext;
  meta: AllTransactionsRowMeta;
}) {
  const active = ctx.selectedId === meta.task.id;
  const moreItems = ctx.resolveRowMoreItems(meta.task, meta.propertyId);
  return (
    <Tr
      hoverable={false}
      className={queueRowClassName({
        active,
        opening: ctx.isTaskOpening(meta.task.id),
      })}
      onClick={() => ctx.handleRowClick(meta.task.id)}
    >
      <Td className="whitespace-nowrap">
        <InteractiveDeedCell
          label={meta.deedCell}
          loading={ctx.isTaskOpening(meta.task.id)}
          trailing={rowAttentionTrailing(ctx, meta.task)}
        />
      </Td>
      <Td>
        <PoNumber
          value={meta.poNumber}
          link
          className="!text-[12.5px] !font-semibold text-text-2"
        />
      </Td>
      <Td className="text-text-2">{meta.assignmentType}</Td>
      <Td className="text-text-2">{meta.city}</Td>
      <Td className="text-text-2">{meta.district}</Td>
      <Td>
        <StatusPill
          label={meta.phaseLabel}
          style={allTransactionsPhaseStyle(meta.task)}
        />
      </Td>
      <QueueRowMoreCell items={moreItems} />
    </Tr>
  );
});

function PoGroupHeaderRow({
  po,
  count,
  open,
  groupIndex,
  onToggleCollapsed,
  onOpenPoProperties,
}: {
  po: string;
  count: number;
  open: boolean;
  groupIndex: number;
  onToggleCollapsed: (po: string) => void;
  onOpenPoProperties: (po: string) => void;
}) {
  return (
    <Tr
      hoverable={false}
      className="cursor-pointer bg-surface-2 animate-[atq-group-row-in_0.28s_ease-out_both] motion-reduce:animate-none"
      style={{
        animationDelay: `${Math.min(groupIndex, 8) * 35}ms`,
      }}
      onClick={() => onOpenPoProperties(po)}
    >
      <Td colSpan={ALL_TRANSACTIONS_SKELETON_COLS}>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="grid place-items-center rounded-md p-0.5 text-text-3 hover:bg-surface"
            title={open ? "طي" : "فتح"}
            aria-label={open ? "طي المجموعة" : "فتح المجموعة"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapsed(po);
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(
                "transition-transform duration-150",
                !open && "-rotate-90",
              )}
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <span dir="ltr" className="text-[13px] font-extrabold text-heading">
            {po}
          </span>
          <span className="rounded-full bg-gold-soft px-2.5 py-0.5 text-[11.5px] font-bold text-gold-d">
            {count} معاملة
          </span>
          <span className="ms-auto inline-flex items-center gap-1 text-[12px] font-bold text-gold-d">
            دخول أمر العمل
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </span>
        </div>
      </Td>
    </Tr>
  );
}

export function AllTransactionsQueueTable({
  ctx,
  filteredMeta,
  groupByPo,
  poGroups,
  collapsedPo,
  onToggleCollapsed,
  onOpenPoProperties,
}: {
  ctx: QueueRowContext;
  filteredMeta: AllTransactionsRowMeta[];
  groupByPo: boolean;
  poGroups: { po: string; rows: AllTransactionsRowMeta[] }[];
  collapsedPo: Record<string, boolean>;
  onToggleCollapsed: (po: string) => void;
  onOpenPoProperties: (po: string) => void;
}) {
  return (
    <Table className="w-full lg:min-w-[720px]" pending={ctx.queuePending}>
      <THead>
        <Tr hoverable={false}>
          <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
          <Th>أمر العمل</Th>
          <Th>نوع الإسناد</Th>
          <Th>المدينة</Th>
          <Th>الحي</Th>
          <Th>المرحلة</Th>
          <ThAction aria-label="المزيد" />
        </Tr>
      </THead>
      <TBody>
        {ctx.showSkeleton ? (
          <SkeletonTableRows rows={6} cols={ALL_TRANSACTIONS_SKELETON_COLS} />
        ) : filteredMeta.length === 0 ? (
          <TableEmptyRow colSpan={ALL_TRANSACTIONS_SKELETON_COLS}>
            لا توجد معاملات مطابقة.
          </TableEmptyRow>
        ) : groupByPo ? (
          poGroups.map(({ po, rows }, groupIndex) => {
            const open = !collapsedPo[po];
            return (
              <Fragment key={po}>
                <PoGroupHeaderRow
                  po={po}
                  count={rows.length}
                  open={open}
                  groupIndex={groupIndex}
                  onToggleCollapsed={onToggleCollapsed}
                  onOpenPoProperties={onOpenPoProperties}
                />
                {open
                  ? rows.map((meta) => (
                      <AllTransactionsRow
                        key={meta.task.id}
                        ctx={ctx}
                        meta={meta}
                      />
                    ))
                  : null}
              </Fragment>
            );
          })
        ) : (
          filteredMeta.map((meta) => (
            <AllTransactionsRow key={meta.task.id} ctx={ctx} meta={meta} />
          ))
        )}
      </TBody>
    </Table>
  );
}
