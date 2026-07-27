"use client";

import {
  ActiveQueueMobileCards,
  toneFromLegacyBadge,
  type ActiveQueueMobileCardItem,
} from "../queue/ActiveQueueMobileCards";
import type { RowMoreMenuItem } from "../ui/RowMoreMenu";
import {
  buildPrimaryDataTableRow,
  findPropertyForTask,
  formatRemainingDuration,
  resolveSlaTimerRatio,
} from "../../lib/prototype/my-task-row";
import type { PoIntakeRecord } from "../../lib/prototype/po-intake-data";
import { formatPoDisplay } from "../../lib/prototype/po-intake-data";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import type { QueueTaskStatusBadge } from "../../lib/prototype/active-queue-list-filters";

/**
 * Mobile task-card list matching docs/المعاين/inspector_screen 1.html.
 * Shown under max-lg for property-inspection queue only.
 */
export function InspectorMobileQueue({
  tasks,
  poByNumber,
  now,
  pending,
  onOpen,
  resolveBadge,
  resolveMoreItems,
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
}) {
  const items: ActiveQueueMobileCardItem[] = tasks.map((task) => {
    const record = poByNumber.get(task.poNumber.trim());
    const property = findPropertyForTask(record, task);
    const row = buildPrimaryDataTableRow(task, property, record, now);
    const badge = resolveBadge(task);
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
      row.city !== "—"
        ? { text: row.city, kind: "place" as const }
        : null,
      row.assignmentType !== "—"
        ? { text: row.assignmentType, kind: "type" as const }
        : null,
    ].filter((v): v is NonNullable<typeof v> => Boolean(v));

    return {
      id: task.id,
      title:
        titleParts.length > 0 ? titleParts.join(" — ") : `مهمة ${task.id}`,
      meta,
      statusLabel: badge?.label,
      statusClassName: badge?.className,
      tone,
      timerLabel: showTimer
        ? timer.remainingOverdue
          ? "متأخرة"
          : `متبقي ${timer.remainingDuration}`
        : undefined,
      timerOverdue: showTimer ? timer.remainingOverdue : undefined,
      timerRatio: showTimer
        ? resolveSlaTimerRatio(
            record?.dueDateAt ?? "",
            task.createdAt ?? "",
            now,
          )
        : undefined,
      moreItems: resolveMoreItems(task, property?.id),
      onOpen: () => onOpen(task.id),
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
