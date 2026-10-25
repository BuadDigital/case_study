"use client";

import {
  ActiveQueueMobileCards,
  toneFromLegacyBadge,
  type ActiveQueueMobileCardItem,
} from "@platform/app-shared/components/ActiveQueueMobileCards";
import type { RowMoreMenuItem } from "@platform/ui-kit";
import {
  buildPrimaryDataTableRow,
  findPropertyForTask,
} from "../../lib/app-data/my-task-row";
import { queueCardMeta, queueCardTimer, queueCardTitle } from "../../lib/app-data/queue-mobile-card";
import type { PoIntakeRecord } from "../../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import type { QueueTaskStatusBadge } from "../../lib/app-data/active-queue-list-filters";

/**
 * Mobile task-card list matching docs/inspector/inspector_screen 1.html.
 * Shown under max-lg for field-inspection queues (active-inspection / legacy).
 */
export function InspectorMobileQueue({
  tasks,
  poByNumber,
  now,
  pending,
  onOpen,
  resolveBadge,
  resolveMoreItems,
  isOpening,
  resolveAttention,
}: {
  tasks: WorkflowTask[];
  poByNumber: Map<string, PoIntakeRecord>;
  now: Date;
  pending?: boolean;
  onOpen: (taskId: string) => void;
  resolveBadge: (task: WorkflowTask) => QueueTaskStatusBadge | null;
  resolveMoreItems: (
    task: WorkflowTask,
    propertyId?: string,
  ) => RowMoreMenuItem[];
  isOpening?: (taskId: string) => boolean;
  resolveAttention?: (task: WorkflowTask) => boolean;
}) {
  const items: ActiveQueueMobileCardItem[] = tasks.map((task) => {
    const record = poByNumber.get(task.poNumber.trim());
    const property = findPropertyForTask(record, task);
    const row = buildPrimaryDataTableRow(task, property, record, now);
    const badge = resolveBadge(task);
    const tone = toneFromLegacyBadge(badge?.className);
    const meta = queueCardMeta(task.poNumber, row);

    return {
      id: task.id,
      title: queueCardTitle(row, property, task.id),
      meta,
      statusLabel: badge?.label,
      statusClassName: badge?.className,
      tone,
      ...queueCardTimer(record, task, now),
      moreItems: resolveMoreItems(task, property?.id),
      onOpen: () => onOpen(task.id),
      loading: isOpening?.(task.id),
      unread: resolveAttention?.(task),
    };
  });

  return (
    <ActiveQueueMobileCards
      items={items}
      pending={pending}
      emptyMessage="لا توجد معاينات مطابقة."
    />
  );
}
