"use client";

/**
 * Row primitives shared by the active-transaction queue tables: the row class
 * recipe, the trailing attention dot, the party-queue deed cell (survey and
 * appraisal render the same gold cell with a property-type subtitle), the
 * "open property detail" trigger and the trailing more-menu cell.
 */
import type { MouseEvent, ReactNode } from "react";
import {
  cn,
  queueTableRowActiveClassName,
  queueTableRowClassName,
  RowAttentionDot,
  RowMoreMenu,
  type RowMoreMenuItem,
  TdAction,
} from "@platform/ui-kit";
import { InteractiveDeedCell } from "../components/ui/InteractiveDeedCell";
import type { WorkflowTask } from "../lib/app-data/tasks-storage";
import type { QueueRowContext } from "./active-transaction-queue-tables-state";

const ROW = queueTableRowClassName;
const ROW_ACTIVE = queueTableRowActiveClassName;

/**
 * The `<Tr>` class every queue row uses: hover group, base row, active state,
 * an optional dimmed variant, then the opening overlay that also blocks clicks.
 */
export function queueRowClassName(args: {
  active: boolean;
  opening: boolean;
  dimmed?: boolean;
}): string {
  return cn(
    "group/atq-row",
    ROW,
    args.active && ROW_ACTIVE,
    args.dimmed && "opacity-55",
    args.opening && "ui-queue-row-opening pointer-events-none",
  );
}

/** Attention dot after the deed label when the row needs the actor's eye. */
export function rowAttentionTrailing(
  ctx: QueueRowContext,
  task: WorkflowTask,
): ReactNode {
  return ctx.resolveRowAttention(task) ? <RowAttentionDot /> : undefined;
}

/** Gold deed cell with the property type underneath — survey and appraisal rows. */
export function PartyQueueDeedCell({
  ctx,
  task,
  propertySlot,
  propertyType,
}: {
  ctx: QueueRowContext;
  task: WorkflowTask;
  propertySlot: string;
  propertyType: string;
}) {
  return (
    <InteractiveDeedCell
      label={propertySlot}
      loading={ctx.isTaskOpening(task.id)}
      tone="gold"
      labelClassName="text-[13.5px] justify-end"
      trailing={rowAttentionTrailing(ctx, task)}
      subtitle={
        propertyType ? (
          <span className="text-[11.5px] font-normal text-text-3 no-underline">
            {propertyType}
          </span>
        ) : null
      }
    />
  );
}

/**
 * Wraps a deed cell in a button that opens the property detail without
 * triggering the row click underneath.
 */
export function PropertyDetailTrigger({
  onOpen,
  ariaLabel,
  children,
}: {
  onOpen: () => void;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="relative z-[1] inline-flex max-w-full cursor-pointer border-0 bg-transparent p-0 font-inherit text-start"
      aria-label={ariaLabel}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      {children}
    </button>
  );
}

/** Trailing more-menu cell — identical on every row. */
export function QueueRowMoreCell({ items }: { items: RowMoreMenuItem[] }) {
  return (
    <TdAction>
      <RowMoreMenu items={items} />
    </TdAction>
  );
}
