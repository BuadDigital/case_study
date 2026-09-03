"use client";

/**
 * Mobile card items for `ActiveTransactionQueueView` — one builder per table
 * layout. Presentation shaping only: it maps already-filtered row meta onto the
 * shared `ActiveQueueMobileCards` item contract and wires the handlers it is given.
 */
import type { RowMoreMenuItem } from "@platform/ui-kit";
import type { ActiveQueueMobileCardItem } from "@platform/app-shared/components/ActiveQueueMobileCards";
import { toneFromLegacyBadge } from "@platform/app-shared/components/ActiveQueueMobileCards";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import {
  buildDistributionTableRow,
  findPropertyForTask,
  formatRemainingDuration,
  remainingTimerTick,
  resolveSlaTimerRatio,
} from "../lib/app-data/my-task-row";
import { formatPoDisplay } from "../lib/app-data/po-intake-data";
import type { PoIntakeRecord } from "../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../lib/app-data/tasks-storage";
import { allTransactionsPhaseStyle } from "../lib/app-data/all-transactions-queue";
import type {
  AllTransactionsRowMeta,
  PrimaryRowMeta,
  QueueLayoutFlags,
} from "./active-transaction-queue-state";

export type QueueMobileCardArgs = {
  flags: QueueLayoutFlags;
  disableRowOpen: boolean;
  filteredAllTxMeta: AllTransactionsRowMeta[];
  filteredListed: WorkflowTask[];
  filteredPrimaryMeta: PrimaryRowMeta[];
  poByNumber: Map<string, PoIntakeRecord>;
  now: Date;
  resolveRowMoreItems: (
    task: WorkflowTask,
    propertyId: string | undefined,
  ) => RowMoreMenuItem[];
  resolveTaskBadge: (
    task: WorkflowTask,
  ) => { label: string; className: string } | null;
  handleRowClick: (taskId: string) => void;
  handleDistributionRowClick: (
    task: WorkflowTask,
    propertyId: string | undefined,
  ) => void;
  isTaskOpening: (taskId: string) => boolean;
};

export function buildQueueMobileCardItems({
  flags,
  disableRowOpen,
  filteredAllTxMeta,
  filteredListed,
  filteredPrimaryMeta,
  poByNumber,
  now,
  resolveRowMoreItems,
  resolveTaskBadge,
  handleRowClick,
  handleDistributionRowClick,
  isTaskOpening,
}: QueueMobileCardArgs): ActiveQueueMobileCardItem[] {
  if (flags.isAllTransactionsTable) {
    return filteredAllTxMeta.map((meta) => {
      const metaLines = [
        { text: formatPoDisplay(meta.poNumber), kind: "po" as const },
        meta.city !== "—" ? { text: meta.city, kind: "place" as const } : null,
        meta.district !== "—"
          ? { text: meta.district, kind: "place" as const }
          : null,
        meta.assignmentType !== "—"
          ? { text: meta.assignmentType, kind: "type" as const }
          : null,
      ].filter((v): v is NonNullable<typeof v> => Boolean(v));
      const done = meta.phaseLabel === "مكتمل";
      return {
        id: meta.task.id,
        title: meta.deedCell,
        meta: metaLines,
        statusLabel: meta.phaseLabel,
        statusStyle: allTransactionsPhaseStyle(meta.task),
        tone: done ? "done" : "pending",
        moreItems: resolveRowMoreItems(meta.task, meta.propertyId),
        onOpen: () => handleRowClick(meta.task.id),
        loading: isTaskOpening(meta.task.id),
      };
    });
  }

  if (flags.isDistributionTable) {
    return filteredListed.map((task) => {
      const record = poByNumber.get(task.poNumber.trim());
      const property = findPropertyForTask(record, task);
      const row = buildDistributionTableRow(task, property, record);
      const deed =
        row.deedLabel && row.deedLabel !== "—"
          ? row.deedLabel.startsWith("صك")
            ? row.deedLabel
            : `صك ${row.deedLabel}`
          : `مهمة ${task.id}`;
      const meta = [
        disableRowOpen
          ? null
          : { text: formatPoDisplay(task.poNumber), kind: "po" as const },
        row.city !== "—" ? { text: row.city, kind: "place" as const } : null,
        row.district !== "—"
          ? { text: row.district, kind: "place" as const }
          : null,
        row.propertyType !== "—"
          ? { text: row.propertyType, kind: "type" as const }
          : null,
      ].filter((v): v is NonNullable<typeof v> => Boolean(v));
      const openDetail = () => handleDistributionRowClick(task, property?.id);
      return {
        id: task.id,
        title: deed,
        meta,
        tone: "new" as const,
        moreItems: resolveRowMoreItems(task, property?.id),
        onOpen: disableRowOpen ? undefined : openDetail,
        onTitleClick: disableRowOpen ? openDetail : undefined,
        footer: disableRowOpen ? (
          <PoNumber value={task.poNumber} link className="text-[12px]" />
        ) : undefined,
        loading: isTaskOpening(task.id),
      };
    });
  }

  return filteredPrimaryMeta.map(({ task, record, property, row }) => {
    const badge = resolveTaskBadge(task);
    const tone = toneFromLegacyBadge(badge?.className);
    const timer = formatRemainingDuration(record?.dueDateAt ?? "", now);
    const showTimer = timer.remainingDuration !== "—";
    const titleParts = [
      row.propertySlot !== "—" ? row.propertySlot : null,
      property?.plotNumber?.trim()
        ? `قطعة ${property.plotNumber.trim()}`
        : null,
      row.district !== "—" ? row.district : null,
    ].filter(Boolean);
    const meta = [
      { text: formatPoDisplay(task.poNumber), kind: "po" as const },
      row.city !== "—" ? { text: row.city, kind: "place" as const } : null,
      row.assignmentType !== "—"
        ? { text: row.assignmentType, kind: "type" as const }
        : null,
    ].filter((v): v is NonNullable<typeof v> => Boolean(v));
    return {
      id: task.id,
      title: titleParts.length > 0 ? titleParts.join(" — ") : `مهمة ${task.id}`,
      meta,
      statusLabel: badge?.label,
      statusClassName: badge?.className,
      tone,
      timerLabel: showTimer
        ? timer.remainingOverdue
          ? "متأخرة"
          : `متبقي ${timer.remainingDuration}`
        : undefined,
      timerTick: showTimer
        ? remainingTimerTick(record?.dueDateAt ?? "")
        : undefined,
      timerOverdue: showTimer ? timer.remainingOverdue : undefined,
      timerRatio: showTimer
        ? resolveSlaTimerRatio(record?.dueDateAt ?? "", task.createdAt ?? "", now)
        : undefined,
      moreItems: resolveRowMoreItems(task, property?.id),
      onOpen: () => handleRowClick(task.id),
      loading: isTaskOpening(task.id),
    };
  });
}
