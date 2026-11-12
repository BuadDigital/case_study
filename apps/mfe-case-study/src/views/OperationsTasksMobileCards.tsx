"use client";

/** Operations-tasks list — the mobile card list built from the visible rows. */

import { useMemo } from "react";
import {
  ActiveQueueMobileCards,
  type ActiveQueueMobileCardItem,
} from "@platform/app-shared/components/ActiveQueueMobileCards";
import {
  OPERATIONS_TASK_STATUS_COLORS,
  operationsTaskStatusLabel,
  operationsTaskTypeLabel,
  taskCountdown,
} from "../lib/app-data/operations-task-display";
import { resolveSlaTimerRatio } from "../lib/app-data/my-task-row";
import { isActiveOperationsTask } from "../lib/app-data/operations-tasks-model";
import { opsCheckInput } from "../lib/app-data/ops-tasks-tw";
import {
  emptyQueueMessage,
  operationsTaskCardLinkMeta,
  operationsTaskCardTone,
  operationsTaskCountdownLabel,
  operationsTaskTimerTick,
  toggleSelectedId,
} from "./operations-tasks-view-state";
import type { OperationsTasksWorkflow } from "./OperationsTasksViewShared";
import { addedSurveyMobileItems } from "./OperationsTasksAddedSurveyRows";
import type { AddedSurveyRow } from "./operations-tasks-added-surveys";

type OperationsTasksMobileCardsProps = Pick<
  OperationsTasksWorkflow,
  | "isDesktopViewport"
  | "now"
  | "rowMenu"
  | "selectedIds"
  | "setDetailId"
  | "setSelectedId"
  | "setSelectedIds"
  | "useIndependentQueue"
  | "visibleTasks"
> & {
  /** Surveys added after the distribution — the first cards (Omar 2026-11-12). */
  surveyRows?: AddedSurveyRow[];
  onOpenSurvey?: (href: string) => void;
};

export function OperationsTasksMobileCards({
  isDesktopViewport,
  now,
  rowMenu,
  selectedIds,
  setDetailId,
  setSelectedId,
  setSelectedIds,
  useIndependentQueue,
  visibleTasks,
  surveyRows,
  onOpenSurvey,
}: OperationsTasksMobileCardsProps) {
  const items = useMemo((): ActiveQueueMobileCardItem[] => {
    if (isDesktopViewport === true) return [];
    const surveys = addedSurveyMobileItems(surveyRows ?? [], (href) => onOpenSurvey?.(href));
    const taskCards = visibleTasks.map((task) => {
      const cd = taskCountdown(task.dueAt, task.status, now);
      const active = isActiveOperationsTask(task);
      const statusColor =
        OPERATIONS_TASK_STATUS_COLORS[task.status] ?? "var(--ink)";
      return {
        id: task.id,
        title: task.title,
        meta: [
          { text: task.displayId, kind: "po" as const },
          { text: operationsTaskTypeLabel(task.type), kind: "type" as const },
          operationsTaskCardLinkMeta(task),
        ],
        statusLabel: operationsTaskStatusLabel(task.status),
        statusStyle: { base: statusColor, fg: statusColor },
        tone: operationsTaskCardTone(task, cd.over),
        timerLabel: active ? operationsTaskCountdownLabel(cd) : undefined,
        timerTick: active
          ? (nowMs: number) =>
              operationsTaskTimerTick(taskCountdown(task.dueAt, task.status, nowMs))
          : undefined,
        timerOverdue: active ? cd.over : undefined,
        timerRatio: active
          ? resolveSlaTimerRatio(task.dueAt, task.createdAt ?? "", new Date(now))
          : undefined,
        moreItems: rowMenu(task),
        onOpen: () => {
          setSelectedId(task.id);
          setDetailId(task.id);
        },
        leading: active ? (
          <input
            type="checkbox"
            className={opsCheckInput}
            checked={Boolean(selectedIds[task.id])}
            onChange={(e) => {
              const on = e.target.checked;
              setSelectedIds((prev) => toggleSelectedId(prev, task.id, on));
            }}
            aria-label="تحديد المهمة"
          />
        ) : undefined,
      };
    });
    return [...surveys, ...taskCards];
  }, [
    isDesktopViewport,
    surveyRows,
    onOpenSurvey,
    visibleTasks,
    now,
    rowMenu,
    selectedIds,
    setSelectedId,
    setDetailId,
    setSelectedIds,
  ]);

  // Mobile card list — after hydration mount only one tree (rendering).
  if (isDesktopViewport === true) return null;
  return (
    <div className="px-3 pb-3 lg:hidden max-lg:px-0">
      <ActiveQueueMobileCards
        items={items}
        emptyMessage={emptyQueueMessage(useIndependentQueue)}
      />
    </div>
  );
}
